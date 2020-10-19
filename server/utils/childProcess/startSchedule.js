const DEFAULT_MESSAGE = 'go to child process'
const NO_PROCESS_ID = 0
const CLOSE_NORMALLY_CODE = 0
const NOT_FIND_INDEX = -1
const path = require('path')
const { fork } = require('child_process')
let processList = {}
/**
 * 判斷此schedule模組是否要啟動
 * @param {Array} disableEnvList 不啟動的環境清單
 * @param {String} env 目前環境設定名稱 EX: qas
 */
function isDisableEnv(disableEnvList, env){
  const envUpperCase = env.toUpperCase()
  let findResult = disableEnvList.findIndex((disableEnv) => disableEnv.toUpperCase() === envUpperCase)
  return (findResult === NOT_FIND_INDEX) ? false : true
}
/**
 * 啟動排程
 * @param {Object} scheduleProcess
 */
function _startup(scheduleProcess){
  scheduleProcess.send(DEFAULT_MESSAGE)
  console.log(`'>>>[${scheduleProcess.pid}] schedule ${_getScheduleNameByPid(scheduleProcess.pid)} process  start at ${new Date().toISOString()}`)
}

function _setErrorHandler(scheduleProcess){
  scheduleProcess.on('error', (error) =>{
    console.warn(`[${scheduleProcess.pid}] schedule ${_getScheduleNameByPid(scheduleProcess.pid)} error : `, error)
  })
}
/**
 * 
 * @param {Object} forkProcess 
 */
function _setAutoRestart(scheduleProcess){
  scheduleProcess.on('close', (code) => {
    let pid = scheduleProcess.pid
    if(code === CLOSE_NORMALLY_CODE){
      console.log(`[${pid}] schedule ${_getScheduleNameByPid(scheduleProcess.pid)} close.`)
    } else {
      scheduleProcess.kill()
      console.log(`[${pid}] schedule ${_getScheduleNameByPid(scheduleProcess.pid)} process exception close. auto restart.`)
      _restartProcess(pid)
    }
  })
}
/**
 * 重新啟動process
 * @param {Number} pid 
 */
function _restartProcess(pid){
  let scheduleInfo = processList[pid]
  _initSchedule(scheduleInfo)
  delete processList[pid]
}
/**
 * 用pid取得Schedule名稱
 * @param {Number} pid 
 * @returns {String} ScheduleName
 */
function _getScheduleNameByPid(pid){
  return processList[pid].scheduleName
}
/**
 *
 * @param {Object} scheduleInfo
 * @param {String} scheduleName
 */
function _initSchedule(scheduleInfo, scheduleName){
  const scheduleProcess = fork(path.join(__dirname, scheduleInfo.fileName))
  processList[scheduleProcess.pid] = {
    pid: scheduleProcess.pid,
    scheduleName: scheduleName,
    ...scheduleInfo,
  }
  _startup(scheduleProcess)
  _setErrorHandler(scheduleProcess)
  _setAutoRestart(scheduleProcess)
}

module.exports = (scheduleInfoList, env) =>{
  Object.keys(scheduleInfoList).map((scheduleName) =>{
    const scheduleInfo = scheduleInfoList[scheduleName]
    if(isDisableEnv(scheduleInfo.disableEnvList, env)){
      return
    }
    _initSchedule(scheduleInfo, scheduleName)
  })
}