const { systemDB, financeDB } = require('../../helpers/database')
const moment = require('moment-timezone')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab finance')
class Finance {
  static async syncV_BUSINESSORG_BO(startTime, endTime, updateBy) {
    logger.debug('----start sync V_BUSINESSORG_BO----')
    let info = {
      typeName: 'V_BUSINESSORG_BO',
      updateBy: updateBy,
    }
    let start = new Date()
    let result
    try {
      result = await financeDB.Query('SELECT KEY ,BG_KEY ,BG_NAME ,BU_KEY ,BU_NAME ,BU2_KEY ,BU2_NAME ,PROFIT_CENTER_KEY ,BPMA_KEY ,SEQN ,UPDR ,UPDT ,CREATEDBY ,CREATEDON ,EFFECTIVEDATE ,EXPIREDDATE ,LASTMODIFIEDBY ,LASTMODIFIEDON ,PRODUCT_NAME ,PRODUCT_KEY ,BD_KEY ,BD_NAME ,ISCOMMONPOOL ,VERSION ,PRODUCT_TYPE_DESC ,BD_DESCRIPTION ,BG_DESCRIPTION ,BU2_DESCRIPTION ,BU_DESCRIPTION ,ID ,ISCOMMIT FROM FINDW.V_BUSINESSORG_BO WHERE  LASTMODIFIEDON >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND LASTMODIFIEDON <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by LASTMODIFIEDON ASC ', [startTime, endTime], false)
      logger.debug('V_BUSINESSORG_BO length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.V_BUSINESSORG_BO (KEY ,BG_KEY ,BG_NAME ,BU_KEY ,BU_NAME ,BU2_KEY ,BU2_NAME ,PROFIT_CENTER_KEY ,BPMA_KEY ,SEQN ,UPDR ,UPDT ,CREATEDBY ,CREATEDON ,EFFECTIVEDATE ,EXPIREDDATE ,LASTMODIFIEDBY ,LASTMODIFIEDON ,PRODUCT_NAME ,PRODUCT_KEY ,BD_KEY ,BD_NAME ,ISCOMMONPOOL ,VERSION ,PRODUCT_TYPE_DESC ,BD_DESCRIPTION ,BG_DESCRIPTION ,BU2_DESCRIPTION ,BU_DESCRIPTION ,ID ,ISCOMMIT, update_time, update_by) \
       VALUES ($1 ,$2 ,$3 ,$4 ,$5 ,$6 ,$7 ,$8 ,$9 ,$10 ,$11 ,$12 ,$13 ,$14 ,$15 ,$16 ,$17 ,$18 ,$19 ,$20 ,$21 ,$22 ,$23 ,$24 ,$25 ,$26 ,$27 ,$28 ,$29 ,$30 ,$31,now(),$32) \
       ON CONFLICT (KEY)  DO UPDATE SET BG_KEY = $2, BG_NAME = $3, BU_KEY = $4, BU_NAME = $5, BU2_KEY = $6, BU2_NAME = $7, PROFIT_CENTER_KEY = $8, BPMA_KEY = $9, SEQN = $10, UPDR = $11,UPDT = $12, CREATEDBY = $13, CREATEDON = $14, EFFECTIVEDATE = $15, EXPIREDDATE = $16, LASTMODIFIEDBY = $17, LASTMODIFIEDON = $18, PRODUCT_NAME = $19, PRODUCT_KEY = $20, BD_KEY = $21,BD_NAME = $22, ISCOMMONPOOL = $23, VERSION = $24, PRODUCT_TYPE_DESC = $25, BD_DESCRIPTION = $26, BG_DESCRIPTION = $27, BU2_DESCRIPTION = $28, BU_DESCRIPTION = $29, ID = $30, ISCOMMIT  = $31, update_time=now(), update_by=$32', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'V_BUSINESSORG_BO', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync V_BUSINESSORG_BO----')
      return result.length
    } catch (e) {
      logger.error('sync V_BUSINESSORG_BO error', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }
}
module.exports = Finance
