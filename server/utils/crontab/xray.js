const { systemDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab Xray')
const moment = require('moment')
const momentTZ = require('moment-timezone')

class XrayDropDown {

  static async syncXrayDropDown(startDate, endDate) {
    let info = {
      typeName: 'XrayDropDown',
      updateBy: 'cronjob',
    }
    try{
      console.log('----start SYNC Xray DropDown list----')
      let start = new Date()
      let result = await systemDB.Query('SELECT * FROM wiprocurement.fn_eproc_get_xray_dropdown()')
      let count = result.rows[0].fn_eproc_get_xray_dropdown
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'XRAYDROPDOWNLIST', count, new Date(), dura_sec, 'complete', `${startDate}|${endDate}`)
      console.log('----end XRAYDROPDOWNLIST----')
    }catch(e) {
      logger.debug('syncXrayDropDown:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncXrayAnalysisPrice() {
    let info = {
      typeName: 'xrayBase',
      updateBy: 'cronjob',
    }

    try {
      console.log('----start SYNC Xray Analysis Price list----')
      let start = new Date()
      let result = await systemDB.Query('SELECT * FROM wiprocurement.fn_eproc_get_xray_analysis_price()')
      let count = result.rows[0].fn_eproc_get_xray_analysis_price
      let dura_sec = (new Date() - start) / 1000
      let endDate = momentTZ().tz('Asia/Taipei').format('YYYY-MM-DD')
      await insertLog('syncData', 'XrayAnalysisPrice', count, new Date(), dura_sec, 'complete', `${endDate}`)
      console.log('----end XrayAnalysisPrice----')
    } catch(e) {
      logger.debug('syncXrayAnalysisPrice:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

}
module.exports = XrayDropDown
