const plmService = require('../../utils/crontab/plm.js')
const bomBaseDataService = require('../../utils/crontab/bomBaseDataSync.js')
const moment = require('moment-timezone')
class syncCbg {
  async syncAll_PMPRJTBL_FOR_DASHBOARD(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await plmService.syncAll_PMPRJTBL_FOR_DASHBOARD(startTime, endTime, 'api')
    ctx.body = 'sync All_PMPRJTBL_FOR_DASHBOARD success'
    ctx.status = 200
  }
  async syncAll_RFQPROJECT_FOR_DASHBOARD(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await plmService.syncAll_RFQPROJECT_FOR_DASHBOARD(startTime, endTime, 'api')
    ctx.body = 'sync All_RFQPROJECT_FOR_DASHBOARD success'
    ctx.status = 200
  }
  async syncPdmparts(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await plmService.syncPdmparts(startTime, endTime, 'api')
    ctx.body = 'sync Pdmparts success'
    ctx.status = 200
  }

  async syncBomBaseData(ctx){
    await bomBaseDataService.syncCustomerNameBase_Data()
    // await bomBaseDataService.syncProductTypeBase_Data()
    ctx.body = 'sync Pdmparts success'
    ctx.status = 200
  }
}
module.exports = syncCbg
