const settingService = require('../../utils/crontab/setting.js')
const moment = require('moment-timezone')

class syncSetting {
  constructor() {
    this.syncEeAssignmentList = this.syncEeAssignmentList.bind(this)
				
  }
  async syncEeAssignmentList(ctx) {
    await settingService.syncEeAssignmentList()
    ctx.body = 'sync Setting type data success'
    ctx.status = 200

  }
}

module.exports = syncSetting