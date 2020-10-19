const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time } = require('../../../config')
const { deleteLog } = require('../../utils/log/log.js')
const syncSetting = require('../../utils/crontab/setting.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('setting')

process.on('message', async function () {

  schedule.scheduleJob(time.dailyRule, async function () {
    logger.debug('init server,start setting type data time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await syncSetting.syncEeAssignmentList()
    logger.debug('end setting type data time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
  })
})

