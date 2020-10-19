const { systemDB } = require('../helpers/database')
let squel = require('squel').useFlavour('postgres')
const { pgConfig: { pgSchema } } = require('../../config.js')
const _ = require('lodash')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('ALTPART')
const moment = require('moment')
const UUID = require('uuid/v4')

const specToSql = async(spec) =>{
  let sql = ""
  Object.keys(spec).map((k) => {
    let num = k.split('spec')[1]
    if (spec[k] != null) {
      sql += `and (si.${spec[k]} ilike sa.${spec[k]} or (si.${spec[k]} is null and sa.${spec[k]} is null)) `
    }
  })
  return sql
}
class ALTPART{
  // find altpart number filter by type1, typ2, spec1, spec2
  static async getAltPartNumbers(partNumber, spec) {
    let specQuery = await specToSql(spec)
    // logger.debug(specQuery)
    let sql = `WITH RECURSIVE t(n) AS (
        SELECT distinct 1, s.itemnum, s.altnum from wiprocurement.sapalt_filter s
        left join wiprocurement.epur_itemtype ti on s.itemnum = ti.item
        left join wiprocurement.epur_itemtype ta on s.altnum = ta.item
        left join wiprocurement.epur_itemspec si on s.itemnum = si.item
        left join wiprocurement.epur_itemspec sa on s.altnum = sa.item
        where  itemnum=\'${partNumber}\'
        and (ti.type1id = ta.type1id or (ti.type1id is null and ta.type1id is null))
        and (ti.type2id = ta.type2id or (ti.type2id is null and ta.type2id is null))
        ${specQuery}
      UNION ALL
        SELECT distinct n+1, r.itemnum, r.altnum from wiprocurement.sapalt_filter r
        inner join t on r.itemnum = t.altnum
        left join wiprocurement.epur_itemtype ti on r.itemnum = ti.item
        left join wiprocurement.epur_itemtype ta on r.altnum = ta.item
        left join wiprocurement.epur_itemspec si on r.itemnum = si.item
        left join wiprocurement.epur_itemspec sa on r.altnum = sa.item
        WHERE n < 10
        and (ti.type1id = ta.type1id or (ti.type1id is null and ta.type1id is null))
        and (ti.type2id = ta.type2id or (ti.type2id is null and ta.type2id is null))
        ${specQuery}
    )
    select distinct altnum from t order by altnum asc;`
    //logger.log(sql.toString())
    const result = await systemDB.Query(sql)

    return result.rows
  }

  static async getAltLowestPrice(partNumbers = []) {
    logger.debug(`alt partNumber: ${partNumbers}`)
    let todayDate = moment().format('YYYY-MM-DD')
    if(partNumbers.length > 0) {
      let pallelNum = 200
      let idx = 0
      let result = []
      while (idx < partNumbers.length) {
        let elms
        if ((idx + pallelNum) < partNumbers.length) {
          elms = partNumbers.slice(idx, (idx + pallelNum))
        } else {
          elms = partNumbers.slice(idx)
        }

        // 將所有的料號 最新的有效日期與 價格撈出來
        let sql2 = squel.select()
          .field('KONWA', 'currency')
          .field('cast( KBETR as numeric)/KPEIN', '"unitPrice"')
          .field('eina.bmatn', '"partNumber"')
          .field('MFRNR', 'manufacturer')
          .field('to_char(datab, \'YYYY-MM-DD\')', 'valid_from')
          .field('a018.matnr')
          .field('eina.lifnr', 'vendor_code')
          .field('eina.mfrpn', 'vendor_pn')
          .field('RANK() OVER (PARTITION BY eina.matnr, KONWA ORDER BY knumh desc)', 'RN')
          .from('wiprocurement.eina', 'eina')
          .join('wiprocurement.a018_konp', 'a018', 'eina.matnr = a018.matnr and eina.lifnr = a018.lifnr')
          .where('LOEVM_KO is null and MFRNR is not null and MFRNR != \'\' and eina.bmatn in ? ', elms)
          .where('(datbi >= ?)', todayDate)
          .where('eina.lifnr in ?', squel.select()
            .field('vendor.vcode')
            .from('wiprocurement.epur_vgroup vendor')
            .where('vendor.ref1 is null or vendor.ref1 = \'\' or UPPER(vendor.ref1) = ?', 'DISTY')
            .where('UPPER(vendor.act_flag) = ?', 'U')
          )
          .order('eina.bmatn')
          .order('knumh', false)

        let sql = `SELECT * FROM (
          ${sql2.toString()}
        ) AS X WHERE X.RN=1`

        let resPromise = await systemDB.Query(sql.toString())
        result.push(...resPromise.rows)

        idx += pallelNum
      }

      return result
    } else {
      logger.warn('cant found MPN part number', partNumbers)
      return []
    }
  }

  static async createSapAltFilter() {
    let sql = `
    truncate table wiprocurement.sapalt_filter;
    insert into wiprocurement.sapalt_filter
    select distinct item_num as itemnum, alt_num as altnum from wiprocurement.sapalt;
    `
    let res = await systemDB.Query(sql)
    return res
  }

  /**
  * 建立ALT group, 將主料與替代料號組成一個group
  */
  static genAltItemGroup(item_name, time = null) {
    let alt_filter_sql = squel.select()
      .distinct()
      .field('itemnum', 'item_num')
      .field('altnum', 'alt_num')
      .field('max(update_time)', 'update_time')
      .from('wiprocurement.sapalt')
      .where('bomchangetype != ?', 'D')
      .where('(changeno LIKE ? AND RUNSERIAL LIKE ?) or RUNSERIAL LIKE ?', 'BRN%', 'DC%', 'EC%')
      .group('itemnum')
      .group('altnum')
      .order('itemnum')

    if (time) {
      alt_filter_sql.where('update_time >= ?', time)
    }

    let alt_sql = squel.select()
      .field(item_name, 'item_num')
      .field('\'A\' || ROW_NUMBER() OVER(ORDER BY item_num)', 'item_group')
      .field('update_time')
      .from(alt_filter_sql, `table_${item_name}`)

    return alt_sql
  }

  static async getAltItemTempGroup(time = null) {
    let item_num_sql = this.genAltItemGroup('item_num', time)
    let alt_num_sql = this.genAltItemGroup('alt_num', time)

    let sql = item_num_sql
      .union_all(alt_num_sql)

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows : []
  }

  /**
   * create ALT filter table, 只有第一次會使用到
   */
  static async truncateAltItemGroup() {
    let sql = `truncate table wiprocurement.sapalt_group;`

    let res = await systemDB.Query(sql)
    return res
  }

  static async createAltItemGroup(items) {
    let resCount = 0

    if(items.length > 0) {
      let pallelNum = 200
      let idx = 0

      while (idx < items.length) {
        let elms
        if ((idx + pallelNum) < items.length) {
          elms = items.slice(idx, (idx + pallelNum))
        } else {
          elms = items.slice(idx)
        }

        let sql = squel.insert()
          .into('wiprocurement.sapalt_group')
          .setFieldsRows(elms)

        // console.log(sql.toString())
        await systemDB.Query(sql.toString())

        resCount += elms.length

        idx += pallelNum
      }
    } else {
      logger.info('items length = 0')
    }

    return resCount
  }

  static async getAltItems() {
    let sql = squel.select()
      .field('item_num')
      .from('wiprocurement.sapalt_group')
      .group('item_num')
      .having('count(1) > 1')

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows : []
  }

  static async getAltItemsExist(items) {
    let sql = squel.select()
      .field('item_num')
      .from('wiprocurement.sapalt_group')
      .where('item_num in ?', items)

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0
  }
  static async upsertMulitAltItemGroups(insertUUID, group_list_id) {

    let sql_item = squel.update()
      .table('wiprocurement.sapalt_group')
      .set('item_group', insertUUID)
      .set('group_update_time', moment().format('YYYY-MM-DD HH:mm:ssZZ'))
      .where('item_group in ?', group_list_id)

    // console.log(sql_item.toString())

    let res = await systemDB.Query(sql_item.toString())
  }

  static async upsertAltItemGroups(item_num) {
    let uuid = UUID()

    let sql_item = squel.update()
      .table('wiprocurement.sapalt_group')
      .set('item_group', uuid)
      .set('group_update_time', moment().format('YYYY-MM-DD HH:mm:ssZZ'))
      .where('item_group in ?', squel.select()
        .distinct()
        .field('item_group')
        .from('wiprocurement.sapalt_group')
        .where('item_num = ?', item_num))

    let res = await systemDB.Query(sql_item.toString())
  }

  static async getAltGroupMaxUpdateTime() {
    let sql = squel.select()
      .field('max(update_time)', 'update_time')
      .from('wiprocurement.sapalt_group')

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows[0].update_time : null
  }

  static async getAltItemsByGroup(item_num, type1name) {
    let sql = squel.select()
      .distinct()
      .field('item_num')
      .field('type1.type1name')
      .from('wiprocurement.sapalt_group alt')
      .join('wiprocurement.epur_itemtype', 'item', 'alt.item_num = item.item')
      .join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .where('item_group in ?', squel.select()
        .distinct()
        .field('item_group')
        .from('wiprocurement.sapalt_group')
        .where('item_num = ?', item_num))
      .where('lower(type1.type1name) = ?', type1name.toLowerCase())

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? _.map(res.rows, 'item_num') : []
  }
  static async getAltItemTypeI(item_num) {
    let sql = squel.select()
      .distinct()
      .field('item.item', 'partnumber')
      .field('type1.type1name')
      .from('wiprocurement.epur_itemtype', 'item')
      .left_join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .where('item.item in ?', item_num)

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows : []
  }
  static async getAltItemGroupAndTypeI(item_num) {
    let sql = squel.select()
      .distinct()
      .field('item_num')
      .field('item_group')
      .field('type1.type1name')
      .from('wiprocurement.sapalt_group alt_group')
      .join('wiprocurement.epur_itemtype', 'item', 'alt_group.item_num = item.item')
      .join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .where('item_group in ?', squel.select()
        .distinct()
        .field('item_group')
        .from('wiprocurement.sapalt_group')
        .where('item_num in ?', item_num))

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows : []
  }

  static async getAltOriginalGroup(item_list) {
    let sql = squel.select()
      .distinct()
      .field('item_num')
      .field('item_group')
      .from('wiprocurement.sapalt_group')
      .where('item_num in ?', item_list)

    let res = await systemDB.Query(sql.toString())
    return res.rowCount > 0 ? res.rows : []
  }
}
module.exports = ALTPART
