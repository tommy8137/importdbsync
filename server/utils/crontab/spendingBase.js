const { systemDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab spendingBase')
class SpendingBase {
  static async syncSpendingBase_Data(startDate, endDate) {
    let info = {
      typeName: 'Spending Base Data',
      updateBy: 'cronjob',
    }
    try{
      console.log('----start SYNC Spending Base Data----')
      let start = new Date()
      await systemDB.Query(`SELECT * FROM wiprocurement.fn_eproc_get_spendingbase('${startDate}', '${endDate}')`)
      let result = await systemDB.Query(`SELECT count(1) FROM wiprocurement.spending_base where date_cpudt_mkpf>='${startDate}' and date_cpudt_mkpf<'${endDate}'`)
      let count = result.rows[0].count
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'SPENDINGBASEDATA', count, new Date(), dura_sec, 'complete', `${startDate}|${endDate}`)
      console.log('----end SPENDINGBASEDATA----')
    }catch(e) {
      logger.debug('syncSpendingBase_Data::::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncSpendingType(startDate, endDate) {
    let info = {
      typeName: 'Spending Type',
      updateBy: 'cronjob',
    }
    try{
      console.log('----start SYNC Spending Type Data----')
      let start = new Date()
      let result = await systemDB.Query(`SELECT * FROM wiprocurement.fn_eproc_get_spendingtypes('${startDate}', '${endDate}')`)
      let count = result.rows[0].fn_eproc_get_spendingtypes
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'SPENDINGTYPEDATA', count, new Date(), dura_sec, 'complete', `${startDate}|${endDate}`)
      console.log('----end SPENDINGTYPEDATA----')
    }catch(e){
      logger.debug('syncSpendingType:::::::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async deleteSpendingBaseData(startDate) {
    let info = {
      typeName: 'delete spending base data',
      updateBy: 'cronjob',
    }
    try{
      console.log('----start delete Spending base Data----')
      let start = new Date()
      await systemDB.Query(`DELETE FROM wiprocurement.spending_base WHERE date < '${startDate}'`)
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'SPENDINGBASEDATA', 0, new Date(), dura_sec, 'deleteComplete')
      console.log('----end delete SPENDINGBaseDATA----')
    }catch(e) {
      logger.debug('deleteSpendingBaseData:::', e)
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
module.exports = SpendingBase
