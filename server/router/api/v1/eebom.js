const router = require('koa-router')
const eeBom = require('../../../api/eebom/synclpp')
const mebomRouter = new router()
const syncEEBomLpp = new eeBom()

mebomRouter.get('/synceebomlpp', syncEEBomLpp.syncEeBomLpp)

module.exports = mebomRouter
