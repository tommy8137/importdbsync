const router = require('koa-router')
const meBom = require('../../../api/mebom/syncmeBom.js')
const mebomRouter = new router()
const syncMEBom = new meBom()

mebomRouter.get('/syncmebomitemprice', syncMEBom.syncMeBomPrice)

module.exports = mebomRouter
