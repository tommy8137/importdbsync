const hrService = require('../../utils/crontab/hr.js')
class syncHr {
  async syncPS_EE_PRCRMNT_VW_A(ctx) {
    const result  = await hrService.syncPS_EE_PRCRMNT_VW_A()
    ctx.body = result
    ctx.status = 200
  }

}
module.exports = syncHr
