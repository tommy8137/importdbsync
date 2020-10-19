const router = require('koa-router')
const xray = require('../../../api/xray/syncXray.js')

const xrayRouter = new router()
const syncxray = new xray()

xrayRouter.get('/syncxrayBaseData', syncxray.syncXrayDropDown)

xrayRouter.get('/syncxrayAnalysisPrice', syncxray.syncXrayAnalysisPrice)
xrayRouter.get('/spa', syncxray.syncSPA)

module.exports = xrayRouter
