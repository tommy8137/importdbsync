const { systemDB, hrDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab hr')
class Finance {
  static async syncPS_EE_PRCRMNT_VW_A() {
    logger.debug('----start sync PS_EE_PRCRMNT_VW_A----')
    let start = new Date()
    let info = {
      typeName: 'PS_EE_PRCRMNT_VW_A',
      updateBy: 'cronjob',
    }
    try {
      const result = await hrDB.Query('SELECT EMPLID, NAME, NAME_A, EMAIL_ADDRESS_A, DEPTID, SUPERVISOR_ID, LOCATION, PHONE_A FROM PS_EE_PRCRMNT_VW_A', [], false)
      logger.debug('PS_EE_PRCRMNT_VW_A length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        await systemDB.Query('INSERT INTO wiprocurement.PS_EE_PRCRMNT_VW_A (EMPLID, NAME, NAME_A, EMAIL_ADDRESS_A, DEPTID, SUPERVISOR_ID, LOCATION, PHONE_A) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (EMPLID)  DO UPDATE SET NAME = $2, NAME_A = $3, EMAIL_ADDRESS_A = $4, DEPTID = $5, SUPERVISOR_ID = $6, LOCATION = $7, PHONE_A = $8', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'PS_EE_PRCRMNT_VW_A', result.length, new Date(), dura_sec, 'complete')
      logger.debug('----end sync PS_EE_PRCRMNT_VW_A----')
      return result.length
    } catch (e) {
      logger.debug('sync PS_EE_PRCRMNT_VW_A error', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }
  static async truncatePS_EE_PRCRMNT_VW_A() {
    logger.debug('----start truncate PS_EE_PRCRMNT_VW_A----')
    let info = {
      typeName: 'truncate PS_EE_PRCRMNT_VW_A',
      updateBy: 'cronjob',
    }
    try {
      let start = new Date()
      await systemDB.Query('TRUNCATE TABLE wiprocurement.PS_EE_PRCRMNT_VW_A')
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'truncate PS_EE_PRCRMNT_VW_A', 0, new Date(), dura_sec, 'complete')
      logger.debug('----end  truncate PS_EE_PRCRMNT_VW_A----')
      return true
    } catch (e) {
      logger.debug('PS_EE_PRCRMNT_VW_A:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }
}
module.exports = Finance
