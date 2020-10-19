// const schedule = require('node-schedule')
// const moment = require('moment-timezone')
// const { time } = require('../../../config')
// const { deleteLog } = require('../../utils/log/log.js')
// const syncSpending = require('../../utils/crontab/spendingBase.js')
// const log4js = require('../logger/logger')
// const logger = log4js.getLogger('spending')

// process.on('message', async function () {
//   let startDate
//   let endDate
//   schedule.scheduleJob(time.dailyRule, async function () {
//     startDate = moment().tz('Asia/Taipei').subtract(1, 'days').format('YYYY-MM-DD')
//     endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
//     logger.debug('init server,start spending data base time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
//     await syncSpending.syncSpendingBase_Data(startDate, endDate)
//     await syncSpending.syncSpendingType(startDate, endDate)
//     let deteleStartDate = moment().tz('Asia/Taipei').subtract(3, 'years').format('YYYY-MM-DD')
//     await syncSpending.deleteSpendingBaseData(deteleStartDate)
//     logger.debug('end spending data base time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
//   })
// })

