(function () {
  'use strict'
  const redisPool = require('../redis/index.js')
  // const redis = require(`redis`);
  // const log4js = require('../logger/index.js')();
  const NAME_SPACE = 'STATE_MACHINE:'

  class StateMachine {
    /**
     *
     * @param {Object} auth 連線的redis Server資訊。
     * EX :
     *  {
     *  host: 127.0.0.1,
     *  port:6373
     *  authPass : ''
     *  }
     */
    constructor (auth) {
      this.key = `${NAME_SPACE}${auth.channel || ''}`
      this.client = redisPool.init(auth)
    }

    /**
    # ██       ██████   ██████ ██   ██
    # ██      ██    ██ ██      ██  ██
    # ██      ██    ██ ██      █████
    # ██      ██    ██ ██      ██  ██
    # ███████  ██████   ██████ ██   ██
    */
    /**
     *  加入指定的fieldKey value，如果fieldKey已存在，則此操作無效。
     * @param {String} fieldKey
     * @param {Any} value
     * @param {Function} callback
     * @returns {Number} 0:失敗 1：成功
     */
    async lock (fieldKey, value, callback) {
      let cResult = await this.client.hsetnx(this.key, fieldKey, value, callback)
      if (typeof callback !== 'function') {
        return cResult
      }
    }
    /**
    #  ██████ ██   ██ ███████  ██████ ██   ██
    # ██      ██   ██ ██      ██      ██  ██
    # ██      ███████ █████   ██      █████
    # ██      ██   ██ ██      ██      ██  ██
    #  ██████ ██   ██ ███████  ██████ ██   ██
     */
    /**
     * 取得指定的fieldKey value
     * @param {String} fieldKey
     * @param {Function} callback
     * @returns {Sting or Object} 沒東西：null 有東西：設定上去的字串
     */
    async check (fieldKey, callback) {
      let cResult = await this.client.hget(this.key, fieldKey, callback)
      if (typeof callback !== 'function') {
        return cResult
      }
    }
    /**
    # ██    ██ ███    ██ ██       ██████   ██████ ██   ██
    # ██    ██ ████   ██ ██      ██    ██ ██      ██  ██
    # ██    ██ ██ ██  ██ ██      ██    ██ ██      █████
    # ██    ██ ██  ██ ██ ██      ██    ██ ██      ██  ██
    #  ██████  ██   ████ ███████  ██████   ██████ ██   ██
     */
    /**
     * 刪除指定的fieldKey value
     * @param {String} fieldKey
     * @param {Function} cb
     * @returns {Number} 0:失敗 1：成功
     */
    async unlock (fieldKey, callback) {
      let cResult = await this.client.hdel(this.key, fieldKey, callback)
      if (typeof callback !== 'function') {
        return cResult
      }
    }
    /**
    # ██    ██ ██████  ██████   █████  ████████ ███████
    # ██    ██ ██   ██ ██   ██ ██   ██    ██    ██
    # ██    ██ ██████  ██   ██ ███████    ██    █████
    # ██    ██ ██      ██   ██ ██   ██    ██    ██
    #  ██████  ██      ██████  ██   ██    ██    ███████
     */
    /**
     * 更新指定的fieldKey value
     * @param {String} fieldKey
     * @param {Any} value
     * @param {Function} cb
     * @returns {Number} 0:覆蓋成功 1：成功設定一個新的fieldKey value
     */
    async update (fieldKey, value, callback) {
      let cResult = await this.client.hset(this.key, fieldKey, value, callback)
      if (typeof callback !== 'function') {
        return cResult
      }
    }
  }
  module.exports = StateMachine
}())
