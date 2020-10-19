const emdmCronJob = require('../../utils/crontab/emdm')
const emdmService = require('../../service/emdm')
const { eproConfig } = require('../../../config.js')

class syncEMDM {
  async syncEMDM_BOM(ctx) {
    const result = await emdmCronJob.syncEmdm()
    ctx.body = result
    ctx.status = 200
  }

  async manualSyncEMDM_BOM(ctx) {
    let req = ctx.request.body
    if(!req.ids){
      ctx.body = 'body key is ids eq:{ids:[1,2,3]}'
      ctx.status = 400
      return
    }
    if(!Array.isArray(req.ids)){
      ctx.body = 'Wrong body type, body request array'
      ctx.status = 400
      return
    }
    const result = await emdmCronJob.syncEmdm(req.ids)
    ctx.body = {
      'bomIds': (result && result.bomIdList && Array.isArray(result.bomIdList) && result.bomIdList.length) ? result.bomIdList : [],
    }
    ctx.status = 200
  }
  async manualRemoveEMDM_BOM (ctx) {
    let req = ctx.request.body
    let env = eproConfig.env || ''
    if(env.trim().toLowerCase() === 'prd') {
      ctx.body = 'do not run this on prd!'
      ctx.status = 400
    }
    if(!req.bomIds){
      ctx.body = 'body key is bomIds eq:{bomIds:[1,2,3]}'
      ctx.status = 400
      return
    }
    if(!Array.isArray(req.bomIds)){
      ctx.body = 'Wrong body type, body request array'
      ctx.status = 400
      return
    }
    const result = await emdmService.delEMDMBomForDebug(req.bomIds)
    ctx.body = {
      'ppchIds': (result && Array.isArray(result) && result.length) ? result : [],
    }
    ctx.status = 200
  }
  async initEmdmId (ctx) {
    try {
      await emdmService.initEmdmId()
      ctx.body = 'done'
      ctx.status = 200
    } catch (error) {
      console.log(error);
      ctx.body = error
      ctx.status = 500
    }
  }
}
module.exports = syncEMDM