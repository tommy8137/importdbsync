const schedule = require('node-schedule')
const moment = require('moment-timezone')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('scheduleEmdm')
const emdmJob = require('../../utils/crontab/emdm')
const { time_emdm } = require('../../../config')

process.on('message', async function () {
  const dailyRule = new schedule.RecurrenceRule()
  // dailyRule.hour = time_emdm.dailyHour
  // dailyRule.minute = time_emdm.dailyMinute
  for (const ruleName in time_emdm) {
    if (time_emdm.hasOwnProperty(ruleName)) {
      let rule = time_emdm[ruleName]
      schedule.scheduleJob(rule, async function () {
        logger.debug('sync MeBomItem last price::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
        await emdmJob.syncEmdm()
        logger.debug('sync finish MeBom last price::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
      })
    }
  }
})