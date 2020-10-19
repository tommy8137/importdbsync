const router = require('koa-router')
const syncAlt = require('../../../api/alt/syncAlt.js')

const altRouter = new router()
const syncALT = new syncAlt()

altRouter.get('/create_ALT_Group', syncALT.createALT_Group)
altRouter.get('/update_ALT_Group', syncALT.updateALT_Group)

module.exports = altRouter
