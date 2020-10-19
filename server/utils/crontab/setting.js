const { systemDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const moment = require('moment')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab setting')
class SettingSync {

  static async syncEeAssignmentList() {
    let info = {
      typeName: 'EeAssignmentList',
      updateBy: 'cronjob',
    }
    try{
      console.log('----start SYNC Setting Type Data----')
      // let start = new Date()
      let result = await systemDB.Query('SELECT * FROM wiprocurement.fn_get_ee_type()')
      console.log(result)
      // let count = result.rows[0].fn_get_ee_type
      // let dura_sec = (new Date() - start) / 1000
      // await insertLog('syncData', 'SETTINGTYPEDATA', count, new Date(), dura_sec, 'complete')
      console.log('----end SETTINGTYPEDATA----')
    }catch(e) {
      logger.debug('EeAssignmentList', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static checkDate(date) {
    let re = /(\d{4})-(\d{2})-(\d{2})/
    if (!date || date === 'undefined' || date == '') {
      return false
    }
    if (!date.match(re)) {
      return false
    }
    return true
  }
}

module.exports = SettingSync
