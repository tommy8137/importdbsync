
const router = require('koa-router')
const cbgRouter = require('./api/v1/cbg.js')
const plmRouter = require('./api/v1/plm.js')
const financeRouter = require('./api/v1/finance.js')
const hrRouter = require('./api/v1/hr.js')
const spendingRouter = require('./api/v1/spendingBase.js')
const xrayRouter = require('./api/v1/xray.js')
const eedmRouter = require('./api/v1/eedm.js')
const settingRouter = require('./api/v1/setting.js')
const mebomRouter = require('./api/v1/mebom.js')
const eebomRouter = require('./api/v1/eebom.js')
const emdmRouter = require('./api/v1/emdm.js')
const altRouter = require('./api/v1/alt.js')


const apiRouter = new router()

apiRouter.use('/cbg', cbgRouter.routes())
apiRouter.use('/plm', plmRouter.routes())
apiRouter.use('/finance', financeRouter.routes())
apiRouter.use('/hr', hrRouter.routes())
apiRouter.use('/spending', spendingRouter.routes())
apiRouter.use('/xray', xrayRouter.routes())
apiRouter.use('/eedm', eedmRouter.routes())
apiRouter.use('/setting', settingRouter.routes())
apiRouter.use('/mebom', mebomRouter.routes())
apiRouter.use('/eebom', eebomRouter.routes())
apiRouter.use('/emdm', emdmRouter.routes())
apiRouter.use('/alt', altRouter.routes())


module.exports = apiRouter
