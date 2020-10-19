const spendingBaseService = require('../../utils/crontab/spendingBase.js')
const moment = require('moment-timezone')

class syncSpendingBase {
  constructor() {
    this.syncSpendingType = this.syncSpendingType.bind(this)
    this.syncSpendingBase_Data = this.syncSpendingBase_Data.bind(this)
  }

  async syncSpendingBase_Data(ctx) {
    let { startDate, endDate } = ctx.request.query
    // startDate = moment().subtract(1, 'days').tz('Asia/Taipei').format('YYYY-MM-DD')
    // endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    if (!spendingBaseService.checkDate(startDate) || !spendingBaseService.checkDate(endDate)) {
      ctx.body = 'date formate is YYYY-MM-DD'
      ctx.status = 400
      return
    }
        
    await spendingBaseService.syncSpendingBase_Data(startDate, endDate)
    ctx.body = 'sync SpendingBase Data success'
    ctx.status = 200
  }

  async syncSpendingType(ctx) {
    let { startDate, endDate } = ctx.request.query
    // startDate = moment().subtract(1, 'days').tz('Asia/Taipei').format('YYYY-MM-DD')
    // endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    if (!spendingBaseService.checkDate(startDate) || !spendingBaseService.checkDate(endDate)) {
      ctx.body = 'date formate is YYYY-MM-DD'
      ctx.status = 400
      return
    }

    await spendingBaseService.syncSpendingType(startDate, endDate)
    ctx.body = 'sync SpendingBase Type success'
    ctx.status = 200
  }

  async deleteSpendingBase_Data(ctx){
    let { startDate } = ctx.request.query
    // startDate = moment().subtract(1, 'days').tz('Asia/Taipei').format('YYYY-MM-DD')
    // endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    if (!spendingBaseService.checkDate(startDate)) {
      ctx.body = 'date formate is YYYY-MM-DD'
      ctx.status = 400
      return
    }
        
    await spendingBaseService.deleteSpendingBaseData(startDate)
    ctx.body = `delete SpendingBase Data small than ${startDate} success`
    ctx.status = 200
  }
}

module.exports = syncSpendingBase