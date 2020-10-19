const router = require('koa-router')
const emdm = require('../../../api/emdm/syncEmdm')
const emdmPartComputer = require('../../../api/emdm/partComputer.js')
const emdmRouter = new router()
const syncEMDM = new emdm()

emdmRouter.get('/syncEMDMBOM', syncEMDM.syncEMDM_BOM)

emdmRouter.post('/syncEMDMBOM', syncEMDM.manualSyncEMDM_BOM)

emdmRouter.delete('/removeEMDMBOM', syncEMDM.manualRemoveEMDM_BOM)

emdmRouter.post('/partComputerDebug', emdmPartComputer.partComputerDebug)

emdmRouter.post('/initEmdmId', syncEMDM.initEmdmId)

module.exports = emdmRouter
