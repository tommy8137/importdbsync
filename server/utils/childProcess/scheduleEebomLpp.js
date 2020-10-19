const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time_mebomlastprice } = require('../../../config')
const job = require('../crontab/eebom.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('eeBomProcess')

process.on('message', async function () {
  const dailyRule = new schedule.RecurrenceRule()
  dailyRule.hour = time_mebomlastprice.dailyHour
  dailyRule.minute = time_mebomlastprice.dailyMinute
  schedule.scheduleJob(dailyRule, async function () {
    logger.debug('sync lpp price::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await job.syncLpp()
    logger.debug('sync finish lpp price::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
  })
})
