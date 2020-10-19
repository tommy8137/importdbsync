const financeService = require('../../utils/crontab/finance.js')
const moment = require('moment-timezone')

class syncCbg {
  async syncV_BUSINESSORG_BO(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await financeService.syncV_BUSINESSORG_BO(startTime, endTime, 'api')
    ctx.body =  'sync V_BUSINESSORG_BO success'
    ctx.status = 200
  }
}
module.exports = syncCbg
