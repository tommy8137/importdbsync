const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time } = require('../../../config')
const { deleteLog } = require('../log/log.js')
const syncXray = require('../crontab/xray.js')
const startDate = moment().tz('Asia/Taipei').subtract(1, 'days').format('YYYY-MM-DD')
const endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('xray')
process.on('message', async function () {

  schedule.scheduleJob(time.dailyRule, async function () {
    logger.debug('init server,start xray drop down list time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await syncXray.syncXrayDropDown(startDate, endDate)
    await syncXray.syncXrayAnalysisPrice()
    logger.debug('end xray drop down list time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
  })
})

