const router = require('koa-router')
const spending = require('../../../api/spending/syncSpending.js')
const spendingRouter = new router()
const syncSpending = new spending()

spendingRouter.get('/syncSpendingBaseData', syncSpending.syncSpendingBase_Data)
spendingRouter.get('/syncSpendingType', syncSpending.syncSpendingType)
spendingRouter.delete('/deleteSpendingBaseData', syncSpending.deleteSpendingBase_Data)

module.exports = spendingRouter
