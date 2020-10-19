const router = require('koa-router')
const hr = require('../../../api/hr/syncHr.js')
const hrRouter = new router()
const syncHr = new hr()

hrRouter.get('/syncPS_EE_PRCRMNT_VW_A', syncHr.syncPS_EE_PRCRMNT_VW_A)

module.exports = hrRouter
