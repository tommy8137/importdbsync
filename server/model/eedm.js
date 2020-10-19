const { systemDB, eedmDB } = require('../helpers/database')
let squel = require('squel').useFlavour('postgres')
const _ = require('lodash')
const EMPTY_ARRAY_LENGTH = 0

module.exports = {
  getPnType: async (pns = []) => {
    let sql = squel.select()
      .distinct()
      .field('item.item', 'partnumber')
      .field('type1name')
      .field('type2name')
      .from('wiprocurement.epur_itemtype', 'item')
      .left_join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .left_join('wiprocurement.epur_type2', 'type2', 'type2.type2id = item.type2id')

    if (pns != null && pns.length != EMPTY_ARRAY_LENGTH) {
      sql.where('item.item in ?', pns)
    }

    const result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? result.rows : []
  },
  getPnRequest: async (pns = []) => {
    let sql = squel.select()
      .distinct()
      .field('partnumber')
      .field('type1name')
      .field('type2name')
      .from('wiprocurement.eedm_pn_request')
      .left_join('wiprocurement.epur_itemtype', 'item', 'item.item = partnumber')
      .left_join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .left_join('wiprocurement.epur_type2', 'type2', 'type2.type2id = item.type2id')

    if (pns != null && pns.length != EMPTY_ARRAY_LENGTH) {
      sql.where('partnumber in ?', pns)
    }

    const result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? result.rows : []
  },

  getLatestExchangeRate: async () => {

    const result = await systemDB.Query(`SELECT a.fcurr as from_currency, a.tcurr as to_currency, a.gdatu as valid_date, a.kursm*a.ukurs/a.ffact*a.tfact as exchange_rate \
      FROM (SELECT * FROM ( \
        SELECT row_number() over (PARTITION  BY fcurr, tcurr ORDER BY gdatu desc) as rn, * \
            FROM wiprocurement.exchange_rate \
            WHERE kurst='M' and tcurr='USD') ex \
          WHERE ex.rn=1)a;`)
    return result.rowCount > 0 ? result.rows : []
  },
  /**
   * 使用CBG表格取得料號＆Rule
   * @param {array} pns partnumber array 可以不填，就搜尋整個Table
   */
  getPNandRule: async (pns = []) => {
    let sql = squel.select().distinct()
      .field('item.item', 'partNumber')
      .field('rules.*')
      .from('wiprocurement.eedm_pn_request', 'request')
      .join('wiprocurement.epur_itemtype', 'item', 'item.item = request.partnumber')
      .join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .join('wiprocurement.epur_type2', 'type2', 'type2.type2id = item.type2id')
      .join('wiprocurement.eebom_spa_rules', 'rules', 'lower(rules.type1) = lower(type1.type1name) and lower(rules.type2) = lower(type2.type2name)')
      .where('type1.type1name is not null and  type2.type2name is not null')
    if (pns != null && pns.length != EMPTY_ARRAY_LENGTH) {
      sql.where('item.item in ?', pns)
    }
    const result = await systemDB.Query(sql.toParam())
    return result
  },
  getlastRecordFromCostSummarytable: async () => {
    let sql = squel.select().distinct()
      .field('max(eedmuploadtime)', 'eedmuploadtime')
      .field('max(uploadtime)', 'uploadtime')
      .from('wiprocurement.eedm_cost_summarytable', 'request')

    const result = await systemDB.Query(sql.toParam())
    return result
  },
  getCostSummaryTableByCond: async (condition) => {
    let selectSQL = squel.select()
      .field('KeyID')
      .field('PCBNO')
      .field('Stage')
      .field('SKU')
      .field('ProjectCode')
      .field('UploadTime')
      .field('Plant')
      .field('PO')
      .field('eEDMUploadTime')
      .field('Platform')
      .field('Panel_Size')
      .from('dbo.Cost_SummaryTable')
    let whereSQL = squel.expr()
    if (condition.keyid) whereSQL.and('KeyID=?', condition.keyid)
    if (condition.pcbno) whereSQL.and('PCBNO=?', condition.pcbno)
    if (condition.stage) whereSQL.and('Stage=?', condition.stage)
    if (condition.sku) whereSQL.and('SKU=?', condition.sku)
    if (condition.projectcode) whereSQL.and('ProjectCode=?', condition.projectcode)
    if (condition.uploadtime) whereSQL.and('UploadTime=?', condition.uploadtime)
    if (condition.eedmuploadtime) whereSQL.and('eEDMUploadTime=?', condition.eedmuploadtime)
    selectSQL.where(whereSQL)
    const result = await eedmDB.Query(selectSQL.toString())
    return result
  },
  getCostSummaryTableByEedmuploadtime: async (eedmuploadtime) => {
    let selectSQL = squel.select()
      .field('KeyID')
      .field('PCBNO')
      .field('Stage')
      .field('SKU')
      .field('ProjectCode')
      .field('UploadTime')
      .field('Plant')
      .field('PO')
      .field('eEDMUploadTime')
      .field('Platform')
      .field('Panel_Size')
      .from('dbo.Cost_SummaryTable')
    let whereSQL = squel.expr()
    whereSQL.and('eEDMUploadTime > ?', eedmuploadtime)
    selectSQL.where(whereSQL)
    const result = await eedmDB.Query(selectSQL.toString())
    return result
  },
  getCostSummaryTableByUploadtime: async (uploadtime) => {
    let selectSQL = squel.select()
      .field('KeyID')
      .field('PCBNO')
      .field('Stage')
      .field('SKU')
      .field('ProjectCode')
      .field('UploadTime')
      .field('Plant')
      .field('PO')
      .field('eEDMUploadTime')
      .field('Platform')
      .field('Panel_Size')
      .from('dbo.Cost_SummaryTable')
    let whereSQL = squel.expr()
    whereSQL.and('UploadTime > ?', uploadtime)
    selectSQL.where(whereSQL)
    const result = await eedmDB.Query(selectSQL.toString())
    return result
  },
  getCostSummaryTableDetailByName: async (tableName) => {
    let queryTableStr = 'SELECT Reference,SchematicName,Sheet,PartNumber,Description,USD,Type,ByModule,PIC_Role,Board,uF,AVAP from [dbo].[' + tableName + ']'
    const result = await eedmDB.Query(queryTableStr)
    return result
  },
  getSuppyType: async (supplyTypeKey, partnumbers = []) => {
    if (partnumbers.length > 0) {
      let sql = squel.select()
        .distinct()
        .field('matnr')
        .from('wiprocurement.marc')
        .where('matnr in ?', partnumbers)
        .where('ZZBSAR in ? or ZZBSAR is null', supplyTypeKey)

      let res = await systemDB.Query(sql.toParam())
      return res.rowCount > 0 ? res.rows : []
    } else {
      return []
    }
  },
  isItemBlock: async (pns) => {
    let sql = squel.select()
      .distinct()
      .field('partnumber')
      .from('wiprocurement.pdmparts')
      .where('partnumber in ? AND lifecyclestate = \'LcsObsoleted\'', pns)

    const result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? result.rows : []
  },

  getCommonPartByPN: async (pns) => {
    let sql = squel.select()
      .distinct()
      .field('partnumber')
      .from('wiprocurement.view_common_parts')
      .where('partnumber in ?', pns)

    const result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? result.rows : []
  },
  getEdmVersionByOption: async (eebomID, uploadtimeList) => {
    let sql = squel.select()
      .field('upload_time')
      .field('id')
      .from('wiprocurement.edm_version')
      .where('eebom_project_id = ?', eebomID)
      .where('upload_time in ? ', uploadtimeList)

    const result = await systemDB.Query(sql.toString())

    return result.rowCount > 0 ? result.rows : []
  },
  getEebomProjectByKeys: async (project) => {
    let sql = squel.select()
      .field('id')
      .field('project_code')
      .field('stage')
      .field('sku')
      .field('pcbno')
      .field('platform')
      .from('wiprocurement.eebom_projects')
      .where('project_code = ?', project.projectcode)
      .where('stage = ?', project.stage)
      .where('sku = ?', project.sku)
      .where('pcbno = ?', project.pcbno)
      .where('platform = ?', project.platform)

    const result = await systemDB.Query(sql.toString())

    return result.rowCount > 0 ? result.rows[0] : null
  },
  getVendorCode: async () => {
    let sql = squel.select()
      .field('vendor.vcode', 'vcode')
      .from('wiprocurement.epur_vgroup vendor')
      .where('vendor.ref1 is null or vendor.ref1 = \'\' or UPPER(vendor.ref1) = ?', 'DISTY')
      .where('UPPER(vendor.act_flag) = ?', 'U')

    let result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? _.map(result.rows, 'vcode') : []
  },
}
