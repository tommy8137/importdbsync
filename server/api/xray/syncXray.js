const xrayService = require('../../utils/crontab/xray.js')
const spaService = require('../../service/spa.js')
const vfilter = require('../../service/venderfilter')

const moment = require('moment-timezone')

class syncXray {
  constructor() {
    this.syncXrayDropDown = this.syncXrayDropDown.bind(this)
  }
  async syncXrayDropDown(ctx) {

    await xrayService.syncXrayDropDown()
    ctx.body = 'sync XrayDropDown List success'
    ctx.status = 200
  }

  async syncXrayAnalysisPrice(ctx) {

    await xrayService.syncXrayAnalysisPrice()
    ctx.body = 'sync XrayAnalysisPrice success'
    ctx.status = 200
  }

  async syncSPA(ctx) {
    let partNumber = '64.24915.6DL'
    let dateTo = '2019-05-30'
    let type1 = 'RES'
    let type2 = 'RES-SMD'
    let spec = ['spec1', 'spec2', 'spec3', 'spec4', 'spec5']
    let cache = []
    let vendorFilter = await new vfilter()
    let result = await spaService.fetchSPA(partNumber, type1, type2, spec, dateTo, cache, vendorFilter)
    ctx.body = result
    ctx.status = 200
  }
}
/*
{
63.10034.L0L
63.10234.L0L
}
*/
module.exports = syncXray
