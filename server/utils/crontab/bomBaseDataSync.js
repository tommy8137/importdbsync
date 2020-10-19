const { systemDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const moment = require('moment')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab BomBaseDataSync')
class BomBaseDataSync {
  static async syncCustomerNameBase_Data() {
    logger.debug('----start SYNC Customer Name Base Data----')
    let info = {
      typeName: 'Customer Name Base Data',
      updateBy: 'cronjob',
    }
    let start = new Date()
    let result
    let count
    try {
      let sql = 'SELECT distinct cusnickname FROM wiprocurement.all_pmprjtbl_for_dashboard \
        WHERE NOT EXISTS (SELECT value FROM wiprocurement.bom_create_basedata WHERE type=$1) AND cusnickname IS NOT NULL'
      result = await systemDB.Query(sql, ['CUSTOMER'])
      let insertSql = 'INSERT INTO wiprocurement.bom_create_basedata(type, key, value) \
        SELECT distinct $1 AS TYPE, cusnickname AS KEY, cusnickname AS VALUE \
        FROM wiprocurement.all_pmprjtbl_for_dashboard  WHERE NOT EXISTS (SELECT value FROM  wiprocurement.bom_create_basedata  WHERE type=$1) AND cusnickname IS NOT NULL'
      await systemDB.Query(insertSql, ['CUSTOMER'])
      count = result.rows.length
    } catch (e) {
      logger.error('syncCustomerNameBase_Data::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
    let dura_sec = (new Date() - start) / 1000
    await insertLog('syncData', 'CREATEBOMBASEDATA', count, new Date(), dura_sec, 'complete')
    logger.debug('----end CustomerNameBase----')
  }

  // static async syncProductTypeBase_Data() {
  //   console.log('----start SYNC Product Type Base Data----')
  //   let info = {
  //     typeName: 'Product Type Base Data',
  //     updateBy: 'cronjob',
  //   }
  //   let start = new Date()
  //   let result
  //   let count
  //   try{
  //     let sql = 'SELECT distinct cusnickname FROM wiprocurement.all_pmprjtbl_for_dashboard \
  //       WHERE NOT EXISTS (SELECT value FROM  wiprocurement.bom_create_basedata WHERE type=$1) AND cusnickname IS NOT NULL'

  //     result = await systemDB.Query(sql, ['PRODUCTTYPE'])

  //     let insertSql = 'INSERT INTO wiprocurement.bom_create_basedata(type, key, value) \
  //   SELECT distinct $1 AS TYPE, producttype AS KEY, producttype AS VALUE \
  //   FROM wiprocurement.all_pmprjtbl_for_dashboard  WHERE NOT EXISTS (SELECT value FROM  wiprocurement.bom_create_basedata WHERE type=$1) AND producttype IS NOT NULL'

  //     await systemDB.Query(insertSql, ['PRODUCTTYPE'])
  //     count = result.rows.length
  //   }catch(e) {
  //     logger.debug('ProductTypeBase_Data::::', e)
  //     info.msg = e
  //     await mail.sendmail(msg.failedMsg(info))
  //   }
  //   let dura_sec = (new Date() - start) / 1000
  //   await insertLog('syncData', 'CREATEBOMBASEDATA', count, new Date(), dura_sec, 'complete')
  //   console.log('----end ProductTypeBase----')
  // }
}

module.exports = BomBaseDataSync
