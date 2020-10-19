/* eslint-disable no-magic-numbers */
let RedisPubSub = require('node-redis-pubsub')
let redisPool = require('../redis/index.js')
const log4js = require('../logger/logger')
const _ = require('lodash')

const { redisConfig } = require('../../../config.js')

let redisClient = redisPool.init(redisConfig)
let logger = null

const WORKING = '1'
const RESTING = '0'

class TaskWorker {
  constructor(config) {
    this.workerStatus = RESTING // 初始化 worker 狀態
    this.workerName = config.workerName || 'worker' // worker 名稱
    this.workerId = `${this.workerName}_${parseInt(Math.random() * 1000)}` // worker id
    this.nameSpace = config.nameSpace || 'taskQueue' // queue 前綴 key
    this.taskQueueKey = `${this.nameSpace}:${config.taskQueueKey}` || `${this.nameSpace}:task` // queue 完整 key
    this.taskProcessQueueKey = `${this.taskQueueKey}Processing` // 運算暫存key
    // this.resultQueueKey = `${this.nameSpace}:${config.resultQueueKey}` || `${this.nameSpace}:result`
    this.workerSkills = config.workerSkills // worker 功能
    this.failNotify = config.failNotify // 故障通知
    this.expireSeconds = config.expireSeconds || 600 // 任務過期時間
    this.checkExpireSeconds = config.checkExpireSeconds || 60 // 多久檢查一次過期任務
    this.expireChecker = null
    this.pubsubClient = null
    this.isConnecting = false
    logger = log4js.getLogger(`[${this.workerId}]`)
  }
  /**
   * 啟動worker
   */
  async run() {
    this._setStatus(RESTING)
    logger.debug('run (init worker)')
    this._subscribeWorkSignal()
    if (this.expireChecker == null) {
      this.expireChecker = setInterval(() => { this._pickupExpireWork() }, this.checkExpireSeconds * 1000)
    }
  }
  /**
   * 取得worker狀態
   */
  _getStatus() {
    return this.workerStatus
  }
  /**
   * 設定worker狀態
   * @param {*} status 
   */
  _setStatus(status) {
    return this.workerStatus = status
  }
  _getSetReConnectState(status = null) {
    if (status == null){
      return this.isConnecting
    } else {
      this.isConnecting = status
    }
  }
  /**
   * 監聽任務頻道
   */
  _subscribeWorkSignal () {
    this._getSetReConnectState(false)
    this.pubsubClient = new RedisPubSub(redisConfig)
    this.pubsubClient.on('error', () => {
      if (this._getSetReConnectState()) {
        return
      }
      this._getSetReConnectState(true)
      logger.warn('pubsubClient connection closed! restarting connection after 3 seconds.')
      // this.pubsubClient.end()
      setTimeout(() => {
        this._subscribeWorkSignal()
      }, 3000)
    })

    logger.debug('subscribe (wait for comming job)')
    this.pubsubClient.subscribe(this.taskQueueKey, async (msg) => {
      if (this._getStatus() === RESTING) {
        logger.info(`receive message:${msg}`)
        logger.info(`wake worker:${this.workerName} up`)
        this._workerToWork()
      }
    })
    if (!this._getSetReConnectState()) {
      this._workerToWork()
    }
  }
  /**
   * worker去工作
   */
  async _workerToWork () {
    logger.debug('toWork (start working)')
    if (this._getStatus() === RESTING) {
      this._setStatus(WORKING)
      this.work()
    }
  }
  /**
   * worker去休息
   */
  async _workerToRest () {
    logger.debug('toRest (stop working)')
    if (this._getStatus() === WORKING) {
      this._setStatus(RESTING)
    }
  }
  /**
   * 檢查過期的工作
   */
  async _pickupExpireWork () {
    logger.trace('pickupExpire (check processing task list)')
    if (this._getStatus() === WORKING) {
      logger.trace('worker is working. pass pickup')
      return
    }
    try {
      let processQueueLength = await redisClient.request('LLEN', this.taskProcessQueueKey)
      if (processQueueLength.error) {
        throw new Error(processQueueLength.error)
      }
      for (let i = 0; i < processQueueLength.data; i++) {
        let timeStamp = new Date().getTime()
        let dataToCheck = await redisClient.request('LRANGE', this.taskProcessQueueKey, i, i)
        if (dataToCheck.error) {
          throw new Error(dataToCheck.error)
        }
        let workData = JSON.parse(dataToCheck.data[0])
        let { route, taskCreateTime, identifyPayload, processPayload } = workData
        let timePass = timeStamp - taskCreateTime
        if ( timePass > 0 && timePass > this.expireSeconds * 1000 ) {
          logger.info(`task expired expireTime:${timePass / 1000} sec. route:`, route, 'taskCreateTime:', taskCreateTime, 'identifyPayload:', identifyPayload, 'processPayload:', processPayload)
          await redisClient.request('lpush', this.taskQueueKey, dataToCheck.data[0])
          await redisClient.request('lrem', this.taskProcessQueueKey, '-1', dataToCheck.data[0])
        }
      }
      if (processQueueLength.data) {
        await this._workerToWork()
      } else {
        logger.trace('nothing to pickup')
      }
    } catch (error) {
      logger.error('_pickupExpireWork with error:', error)
    }
  }
  /**
   * 工作
   */
  async work() {
    logger.debug('work')
    try{
      let workToDo = await redisClient.request('rpoplpush', this.taskQueueKey, this.taskProcessQueueKey)
      if (workToDo.error) {
        throw new Error(workToDo.error)
      }
      if (workToDo.data == null) {
        await this._workerToRest()
        return
      }
      let workData = JSON.parse(workToDo.data)
      let { route, taskCreateTime, identifyPayload } = workData
      if (!_.has(this.workerSkills, route)) {
        logger.error('not supported route:', route)
        return
      }
      logger.info('start processing task route:', route, 'taskCreateTime:', taskCreateTime, 'identifyPayload:', identifyPayload)
      let result = null
      let skill = _.get(this.workerSkills, route)
      let { processFn, resultFn } = skill
      if (processFn.constructor.name === 'AsyncFunction') {
        result = await processFn(workData)
      } else {
        result = processFn(workData)
      }
      if (resultFn.constructor.name === 'AsyncFunction') {
        await resultFn(workData, result)
      } else {
        resultFn(workData, result)
      }
      let processDone = await redisClient.request('lrem', this.taskProcessQueueKey, '-1', workToDo.data)
      if (processDone.error) {
        throw new Error(processDone.error)
      }
      if (parseInt(processDone.data, 10) !== 1) {
        logger.error('worker unable to remove done task route:', route, 'taskCreateTime:', taskCreateTime, 'identifyPayload:', identifyPayload)
      }
    } catch (error) {
      logger.error('worker doing task with error:', error)
      if (this.failNotify.constructor.name === 'AsyncFunction') {
        await this.failNotify(error)
      } else {
        this.failNotify(error)
      }
    }
    setImmediate(this.work.bind(this))
  }
  
}

module.exports = TaskWorker

