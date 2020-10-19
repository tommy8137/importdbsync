const altService = require('../../service/alt.js')

class getEEDM {
  /**
   * 第一次建立整個ALT group表格
   */
  async createALT_Group(ctx) {
    await altService.createALT_Group()
    ctx.body = 'create ALT_Group success'
    ctx.status = 200
  }
  /**
   * 更新ALT group表格, 每一天凌晨都要更新一次, 才能跑syncSAP_ALT_PN, 找ALT價格
   */
  async updateALT_Group(ctx) {
    await altService.updateALT_Group()
    ctx.body = 'update ALT_Group success'
    ctx.status = 200
  }
}
module.exports = getEEDM
