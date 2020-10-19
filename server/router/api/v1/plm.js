const router = require('koa-router')
const plm = require('../../../api/plm/syncPlm.js')
const plmRouter = new router()
const syncplm = new plm()

plmRouter.get('/syncAll_PMPRJTBL_FOR_DASHBOARD', syncplm.syncAll_PMPRJTBL_FOR_DASHBOARD)
plmRouter.get('/syncAll_RFQPROJECT_FOR_DASHBOARD', syncplm.syncAll_RFQPROJECT_FOR_DASHBOARD)

plmRouter.get('/syncPdmparts', syncplm.syncPdmparts)

plmRouter.get('/syncBomBaseData', syncplm.syncBomBaseData)

module.exports = plmRouter
