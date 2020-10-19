const mebomService = require('../../utils/crontab/mebom.js')

class syncMEBom {
  async syncMeBomPrice(ctx) {
    await mebomService.syncPartnumberPrice()
    ctx.body = 'sync MEBOM_Price success'
    ctx.status = 200
  }
}

module.exports = syncMEBom