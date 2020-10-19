const cbgService = require('../../utils/crontab/cbg.js')
const moment = require('moment-timezone')
class syncCbg {
  async syncEPUR_ITEMSPEC(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_ITEMSPEC(startTime, endTime, 'api')
    ctx.body = 'sync EPUR_ITEMSPEC success'
    ctx.status = 200
  }
  async syncEPUR_SOURCEDEF(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_SOURCEDEF(startTime, endTime, 'api')
    ctx.body = 'sync EPUR_SOURCEDEF success'
    ctx.status = 200
  }
  async syncEPUR_SOURCERPROXY(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_SOURCERPROXY(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_SOURCERPROXY success'
    ctx.status = 200
  }
  async syncEPUR_VGROUP(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_VGROUP(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_VGROUP success'
    ctx.status = 200
  }
  async syncEPUR_TYPE1(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_TYPE1(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_TYPE1 success'
    ctx.status = 200
  }
  async syncEPUR_TYPE2(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_TYPE2(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_TYPE2 success'
    ctx.status = 200
  }
  async syncEPUR_SPEC_TITLE(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_SPEC_TITLE(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_SPEC_TITLE success'
    ctx.status = 200
  }
  async syncEPUR_ITEMTYPE(ctx) {
    let { startTime, endTime } = ctx.request.query
    startTime = moment().tz('Asia/Taipei').format(`${startTime} 00:00:00`)
    endTime = moment().tz('Asia/Taipei').format(`${endTime} 23:59:59`)
    await cbgService.syncEPUR_ITEMTYPE(startTime, endTime, 'api')
    ctx.body =  'sync EPUR_ITEMTYPE success'
    ctx.status = 200
  }
  async backdoor(ctx){
    let { pn } = ctx.params
    let { cal } = ctx.request.query
    let result = await cbgService.getBackdoorInfo(pn, cal)
    ctx.body = result
    ctx.status = 200
  }
}
module.exports = syncCbg
