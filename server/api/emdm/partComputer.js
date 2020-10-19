
const emdmPartComputer = require('../../service/emdmPartComputer.js')

class partComputer {
  static async partComputerDebug(ctx) {
    let req = ctx.request.body
    const result = await emdmPartComputer.debugPartComputer(req)
    ctx.set('Content-Type', 'application/json')
    ctx.body = result
    ctx.status = 200
  }
}
module.exports = partComputer

