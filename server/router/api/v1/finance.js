const router = require('koa-router')
const finance = require('../../../api/finance/syncFinance.js')
const financeRouter = new router()
const syncFinance = new finance()

financeRouter.get('/syncV_BUSINESSORG_BO', syncFinance.syncV_BUSINESSORG_BO)

module.exports = financeRouter
