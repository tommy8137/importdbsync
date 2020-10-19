const eedmService = require('../../utils/crontab/eedm.js')
const aggreEEbom = require('../../utils/crontab/eebom')
const moment = require('moment-timezone')

class syncEEDM {
  async syncSAP_ALT_PN(ctx) {
    await eedmService.syncSAP_ALT_PN()
    ctx.body = 'sync syncSAP_ALT_PN success'
    ctx.status = 200
  }
  async syncEEBOM_PIPE(ctx) {
    let { startDate, endDate } = ctx.request.query
    startDate = moment(startDate).tz('Asia/Taipei').format('YYYY-MM-DD')
    endDate = moment(endDate).tz('Asia/Taipei').format('YYYY-MM-DD')
    await eedmService.syncEEDM_COST_SUMMARYTABLE()
    await eedmService.syncEEDM_PN_LIST()
    await eedmService.syncEEDM_Common_Patrs()


    await eedmService.syncEEDM_PN_PRICE()
    // syncEEDM_PN_PRICE 相等於跑 以下三個function
    // await eedmService.syncEEDM_PN_HIGHEST_PRICE()
    // await eedmService.syncEEDM_PN_LOWEST_PRICE()
    // await eedmService.syncEEDM_PN_2ND_HIGHEST_PRICE()

    //await eedmService.syncEEDM_SPA_PRICE(startDate, endDate)
    await eedmService.syncSAP_ALT_PN()
    let vids = await eedmService.syncEEBomBase()
    await aggreEEbom.aggre_BOM_DETAIL_TABLE(vids)
    ctx.body = 'sync EEBOM_PIPE success'
    ctx.status = 200
  }
  async syncEEBOM_BASE_PIPE(ctx) {
    let { body } = ctx.request
    let vids = await eedmService.syncEEBomBase()
    await aggreEEbom.aggre_BOM_DETAIL_TABLE(vids)

    ctx.body = 'sync syncEEBom success'
    ctx.status = 200
  }

  async syncEEBOM_BASE(ctx) {
    let { body } = ctx.request
    await eedmService.syncEEBomBase(body)
    ctx.body = 'sync EEDM_BASE success'
    ctx.status = 200
  }
  async reEEBOM_PROJECT(ctx) {
    await eedmService.rebuildEEBOMProject()
    ctx.body = 'rebuild EEBOM_PROJECT success'
    ctx.status = 200
  }
  async syncEEBOM_DETAIL(ctx) {
    await aggreEEbom.aggre_BOM_DETAIL_TABLE()  // 會將所有version更新
    ctx.body = 'sync EEDM_DETAIL success'
    ctx.status = 200
  }
  async syncEEBOM_DETAIL_BY_VERSION(ctx) {
    let {version} = ctx.request.query
    var vids = []
    vids.push(version)
    await aggreEEbom.aggre_BOM_DETAIL_TABLE(vids)  // 會將指定version更新
    ctx.body = 'sync EEDM_DETAIL success'
    ctx.status = 200
  }
  async syncEEDM_BOM_ITEM(ctx) {
    let {tableName} = ctx.request.query
    await eedmService.syncEEDM_BOM_ITEM(tableName)  // 會將指定table name更新 bom item
    ctx.body = 'sync EEDM_BOM_ITEM success'
    ctx.status = 200
  }
  async syncEEDM_COST_SUMMARYTABLE(ctx) {
    let { body } = ctx.request
    const result = await eedmService.syncEEDM_COST_SUMMARYTABLE(body)
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_PN_LIST(ctx) {
    const result = await eedmService.syncEEDM_PN_LIST()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_COMMON_PARTS(ctx) {
    const result = await eedmService.syncEEDM_Common_Patrs()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_PN_PRICE(ctx) {
    const result = await eedmService.syncEEDM_PN_PRICE()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_PN_HIGHEST_PRICE(ctx) {
    const result = await eedmService.syncEEDM_PN_HIGHEST_PRICE()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_PN_LOWEST_PRICE(ctx) {
    const result = await eedmService.syncEEDM_PN_LOWEST_PRICE()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_PN_2ND_HIGHEST_PRICE(ctx) {
    const result = await eedmService.syncEEDM_PN_2ND_HIGHEST_PRICE()
    ctx.body = result
    ctx.status = 200
  }
  async syncEEDM_SPA_PRICE(ctx) {
    let { startDate, endDate } = ctx.request.query
    startDate = moment(startDate).tz('Asia/Taipei').format('YYYY-MM-DD')
    endDate = moment(endDate).tz('Asia/Taipei').format('YYYY-MM-DD')
    const result = await eedmService.syncEEDM_SPA_PRICE(startDate, endDate)
    ctx.body = result
    ctx.status = 200
  }

  async get_EEDM_SPA_PRICE_BY_PN(ctx) {
    let { partnumber } = ctx.request.query
    const result = await eedmService.get_EEDM_SPA_PRICE_BY_PN(partnumber)
    ctx.body = result
    ctx.status = 200
  }

  async get_EEDM_ALT_PRICE_BY_PN(ctx) {
    let { partnumber } = ctx.request.body
    const result = await eedmService.get_EEDM_ALT_PRICE_BY_PN(partnumber)
    ctx.body = result
    ctx.status = 200
  }
  async getALT_GROUP_PRICE_BY_PN(ctx) {
    let { partnumber } = ctx.request.body
    const result = await eedmService.getALT_GROUP_PRICE_BY_PN(partnumber)
    ctx.body = result
    ctx.status = 200
  }
  async getEEDM_PN_LOWEST_PRICE_BY_PN(ctx) {
    let { partnumber } = ctx.request.body
    const result = await eedmService.getEEDM_PN_LOWEST_PRICE_BY_PN(partnumber)
    ctx.body = result
    ctx.status = 200
  }
  async pcbSyncResult(ctx) {
    try {
      let { isSuccess, message } = ctx.request.body
      await eedmService.pcbSyncResult(isSuccess, message)
      ctx.status = 200
    } catch (error) {
      throw new error(error)
    }
  }
}
module.exports = syncEEDM
