const eebomService = require('../../utils/crontab/eebom.js')

class syncMEBom {
  async syncEeBomLpp(ctx) {
    await eebomService.syncLpp()
    ctx.body = 'sync EEBOM_Lpp_success'
    ctx.status = 200
  }
}

module.exports = syncMEBom