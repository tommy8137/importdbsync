const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time } = require('../../../config')
const { deleteLog } = require('../../utils/log/log.js')
const syncBomBaseData = require('../../utils/crontab/bomBaseDataSync')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('eeBomBaseData')

process.on('message', async function () {
  schedule.scheduleJob(time.dailyRule, async function () {
    logger.debug('init server,start spending data base time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await syncBomBaseData.syncCustomerNameBase_Data()
    // await syncBomBaseData.syncProductTypeBase_Data()
    logger.debug('end BomBaseData time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
  })
})
