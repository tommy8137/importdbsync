const router = require('koa-router')
const setting = require('../../../api/setting/syncSetting')
const settingRouter = new router()
const syncSetting = new setting()


settingRouter.get('/syncSettingType', syncSetting.syncEeAssignmentList)


module.exports = settingRouter