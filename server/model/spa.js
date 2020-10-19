const { systemDB } = require('../helpers/database')
let squel = require('squel').useFlavour('postgres')
const { pgConfig: { pgSchema } } = require('../../config.js')
const _ = require('lodash')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('SPA')
const moment = require('moment')

/**
 *
 * @param {array} list 在今天時間區間內的流水號與時間
 * @returns {object} 最大的流水號與時間
 */
const getLatestKnumh = (list) => {
  let groupByK = _.groupBy(list, 'knumh')
  let keys = Object.keys(groupByK)
  let latestByKnumh = (groupByK[_.sortedUniq(keys)[0]])

  let latestRes
  if (latestByKnumh.length == 1 && latestByKnumh[0].datbi == '2099-12-31') {
    // console.log('只有2099-12-31')
    latestRes = latestByKnumh
  } else if (latestByKnumh.length > 1 && _.find(latestByKnumh, v => v.datbi == '2099-12-31')) {
    // console.log('有 2099-12-31 and 其他的 日期')
    latestRes = _.chain(latestByKnumh)
      .map((r) => {
        if (r.datbi != '2099-12-31')
          return r
      })
      .filter(x => !!x)
      .orderBy(['knumh', 'datbi'], ['desc', 'desc'])
      .value()


  } else if (latestByKnumh.length >= 1 && !_.find(latestByKnumh, v => v.datbi == '2099-12-31')) {
    // console.log('其他的 日期 and 沒有 2099-12-31')
    latestRes = latestByKnumh
  } else {
    logger.error('Error: ', latestByKnumh.length, latestByKnumh)
  }

  return {
    knumbLatest: latestRes[0].knumh,
    dateByknumh: latestRes[0].datbi,
  }
}

class SPA {
  static async getTypeIandTypeII(partNumber) {

    let sql = squel.select().distinct()
      .field('item.item', 'partNumber')
      .field('type1.type1name', 'type1')
      .field('type2.type2name', 'type2')
      .from(`${pgSchema}.epur_itemtype`, 'item')
      .join(`${pgSchema}.epur_type1`, 'type1', 'type1.type1id = item.type1id')
      .join(`${pgSchema}.epur_type2`, 'type2', 'type2.type2id = item.type2id')
      .where('item.item = ? ', partNumber)

    const result = await systemDB.Query(sql.toParam())
    if (result.rowCount > 0) {
      return result.rows[0]
    } else {
      return false
    }
  }
  static async getTypeIandII(partNumber) {

    let sql = squel.select().distinct()
      .field('item.item', 'partNumber')
      .field('type1.type1name', 'type1')
      .field('type2.type2name', 'type2')
      .from(`${pgSchema}.epur_itemtype`, 'item')
      .join(`${pgSchema}.epur_type1`, 'type1', 'type1.type1id = item.type1id')
      .join(`${pgSchema}.epur_type2`, 'type2', 'type2.type2id = item.type2id')
      .where('item.item = ? ', partNumber)

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }
  static async getSpecByPN(partNumber) {
    let sql = squel.select().distinct()
      .field('spec1').field('spec2').field('spec3').field('spec4').field('spec5')
      .field('spec6').field('spec7').field('spec8').field('spec9').field('spec10')
      .field('spec11').field('spec12').field('spec13').field('spec14').field('spec15')
      .field('spec16').field('spec17').field('spec18').field('spec19').field('spec20')
      .field('spec21').field('spec22').field('spec23').field('spec24').field('spec25')
      .field('spec26').field('spec27').field('spec28').field('spec29').field('spec30')
      .from(`${pgSchema}.epur_itemspec`, 'spa')
      .where('item = ? ', partNumber)

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getSpecList(type1, type2) {
    let sql = squel.select().distinct()
      .field('spec1').field('spec2').field('spec3').field('spec4').field('spec5')
      .field('spec6').field('spec7').field('spec8').field('spec9').field('spec10')
      .field('spec11').field('spec12').field('spec13').field('spec14').field('spec15')
      .field('spec16').field('spec17').field('spec18').field('spec19').field('spec20')
      .field('spec21').field('spec22').field('spec23').field('spec24').field('spec25')
      .field('spec26').field('spec27').field('spec28').field('spec29').field('spec30')
      .from(`${pgSchema}.eebom_spa_rules`, 'spa')
      .where('lower(type1) = lower(?) and lower(type2) = lower(?) ', type1, type2)

    const result = await systemDB.Query(sql.toParam())
    if (result.rowCount > 0) {
      return result.rows[0]
    } else {
      return {}
    }
  }

  static async getSpaRuleByPn(pn) {
    let sql = squel.select().distinct()
      .field('item.item', 'partNumber')
      .field('rules.*')
      .from('wiprocurement.epur_itemtype', 'item')
      .join('wiprocurement.epur_type1', 'type1', 'type1.type1id = item.type1id')
      .join('wiprocurement.epur_type2', 'type2', 'type2.type2id = item.type2id')
      .join('wiprocurement.eebom_spa_rules', 'rules', 'lower(rules.type1) = lower(type1.type1name) and lower(rules.type2) = lower(type2.type2name)')
      .where('item.item = ?', pn)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getSpecByPartNumber(partNumber, spec) {
    let sql = squel.select().distinct()
      .from(`${pgSchema}.epur_itemspec`, 'spec')
      .where('spec.item = ?', partNumber)

    if (spec.length > 0) {
      spec.map(s => {
        let num = s.split('spec')[1]
        let key = num < 10 ? `spec${num}` : s
        sql.field(s, key)
      })
    }

    const result = await systemDB.Query(sql.toParam())
    if (result.rowCount > 0) {
      return result.rows[0]
    } else {
      return {}
    }
  }

  static async getItembySpec(supplyTypeKey, type1, type2, spec) {

    let sql = squel.select()
      .distinct()
      .field('item.item', '"partNumber"')
      .from(`${pgSchema}.epur_itemtype`, 'item')
      .join(`${pgSchema}.epur_itemspec`, 'spec', 'spec.item = item.item')
      .join(`${pgSchema}.epur_type1`, 'type1', 'type1.type1id = item.type1id')
      .join(`${pgSchema}.epur_type2`, 'type2', 'type2.type2id = item.type2id')
      .join(`${pgSchema}.marc`, 'marc', 'item.item = marc.matnr')
      .join(`${pgSchema}.mara`, 'mara', 'marc.matnr = mara.matnr')
      .where('lower(type1.type1name) = lower(?) and lower(type2.type2name) = lower(?) and (ZZBSAR in ? or ZZBSAR is null)', type1, type2, supplyTypeKey)

    Object.keys(spec).map((k) => {
      let num = k.split('spec')[1]
      if (spec[k] != null) {
        sql.where(`lower(spec${Number(num)}) = lower(?)`, spec[k])
      }
    })

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getMinPartnumber(partNumbers, vendorFilter) {
    logger.debug(`similar partNumber: ${partNumbers}`)

    let matnrSql = squel.select().distinct()
      .field('eina.matnr')
      .field('lifnr')
      .from('wiprocurement.eina', 'eina')
      .where('eina.bmatn in ?', partNumbers)

    let matnrResult = await systemDB.Query(matnrSql.toParam())
    if (matnrResult.rowCount > 0) {
      let matnr = []
      _.forEach(matnrResult.rows, (m) => {
        if (vendorFilter.includes(m.lifnr)) {
          matnr.push(m.matnr)
        }
      })

      // let matnr = matnrResult.rows
      // let matnr = _.chain(matnrResult.rows)
      //   .map(m => {
      //     if (vendorFilter.isFiltered(m.lifnr)) return m.matnr
      //   })
      //   .filter(x => !!x)
      //   .value()

      // 找出 料號 有效日期大於今天 最小的unit price
      // let sql2 = squel.select().distinct()
      //   .field('KONWA', 'currency')
      //   .field('min(cast( KBETR as numeric) / KPEIN )', '"unitPrice"')
      //   .field('eina.bmatn', '"partNumber"')
      //   .field('MFRNR', 'manufacturer')
      //   .field('RANK() OVER (PARTITION BY KONWA ORDER BY min(cast( KBETR as numeric) / KPEIN ))', 'RN')
      //   .from('wiprocurement.eina', 'eina')
      //   .join('wiprocurement.a018_konp', 'a018', 'eina.matnr = a018.matnr and eina.lifnr = a018.lifnr')
      //   .where('eina.matnr in ? and MFRNR is not null and MFRNR != \'\' AND (datbi >= ?)', matnr, date)
      //   .group('currency')
      //   .group('eina.bmatn')
      //   .group('MFRNR')

      // let sql = `SELECT * FROM (
      //     select distinct KONWA as currency, min(cast( KBETR as numeric) / KPEIN ) as unitPrice, eina.bmatn as "partNumber",
      //     MFRNR as manufacturer, eina.matnr
      //         , RANK() OVER (PARTITION BY KONWA ORDER BY min(cast( KBETR as numeric) / KPEIN )) AS RN
      //     from wiprocurement.eina as eina
      //     join wiprocurement.a018_konp as a018 on (eina.matnr = a018.matnr)
      //     where eina.bmatn in (${partNumbers}) and MFRNR is not null
      //     AND (datab <= ${date} AND datbi >= ${date})
      //     group by currency, eina.bmatn, eina.matnr, MFRNR
      //   ) AS X WHERE X.RN=1`

      let pallelNum = 200
      let idx = 0
      let result = []
      while (idx < matnr.length) {
        let elms
        if ((idx + pallelNum) < matnr.length) {
          elms = matnr.slice(idx, (idx + pallelNum))
        } else {
          elms = matnr.slice(idx)
        }

        // 將所有的料號 最新的有效日期與 價格撈出來
        let sql2 = squel.select()
          .field('KONWA', 'currency')
          .field('cast( KBETR as numeric)/KPEIN', '"unitPrice"')
          .field('eina.bmatn', '"partNumber"')
          .field('MFRNR', 'manufacturer')
          .field('to_char(datbi, \'YYYY-MM-DD\')', 'datbi')
          .field('to_char(datab, \'YYYY-MM-DD\')', 'valid_from')
          .field('a018.matnr')
          .field('RANK() OVER (PARTITION BY eina.matnr ORDER BY knumh desc)', 'RN')
          .from('wiprocurement.eina', 'eina')
          .join('wiprocurement.a018_konp', 'a018', 'eina.matnr = a018.matnr and eina.lifnr = a018.lifnr')
          .where('eina.matnr in ? and LOEVM_KO is null and MFRNR is not null and MFRNR != \'\' and eina.bmatn in ? ', elms, partNumbers)
          .order('eina.bmatn')
          .order('knumh', false)

        let sql = `SELECT * FROM (
          ${sql2.toString()}
        ) AS X WHERE X.RN=1`

        let resPromise = await systemDB.Query(sql.toString())
        result.push(...resPromise.rows)
        logger.warn('complete from idx:', idx, 'to:', (idx + pallelNum))
        idx += pallelNum
      }

      return result
    } else {
      logger.warn('cant found MPN part number', partNumbers)
      return []
    }

    // let matnrSql = squel.select().distinct()
    //   .field('eina.matnr')
    //   .field('lifnr')
    //   .from('wiprocurement.eina', 'eina')
    //   .where('eina.bmatn in ?', partNumbers)

    // let matnrResult = await systemDB.Query(matnrSql.toParam())
    // if (matnrResult.rowCount > 0) {
    //   let pallelNum = 20
    //   let idx = 0
    //   let result = []
    //   // let matnr = matnrResult.rows.map(m => m.matnr)

    //   let matnr = _.chain(matnrResult.rows)
    //     .map(m => {
    //       if (vendorFilter.isFiltered(m.lifnr)) return m.matnr
    //     })
    //     .filter(x => !!x)
    //     .value()

    //   while (idx < matnr.length) {
    //     let selectedElms
    //     if ((idx + pallelNum) < matnr.length) {
    //       selectedElms = matnr.slice(idx, (idx + pallelNum))
    //     } else {
    //       selectedElms = matnr.slice(idx)
    //     }

    //     let resPromise = await Promise.all(selectedElms.map(async elm => {
    //       // let sql = squel.select()
    //       //   .field('knumh')
    //       //   .field(`to_char(datbi, 'YYYY-MM-DD')`, 'datbi')
    //       //   .from('wiprocurement.a018_konp')
    //       //   .where('matnr = ? AND (datab <= ? AND datbi >= ?) and LOEVM_KO is null', elm, date, date)
    //       //   .order('knumh', false)
    //       //   .order('datbi')
    //       let sql = squel.select()
    //         .field('knumh')
    //         .field(`to_char(datbi, 'YYYY-MM-DD')`, 'datbi')
    //         .from('wiprocurement.a018_konp')
    //         .where('matnr = ?  and LOEVM_KO is null', elm)
    //         .order('knumh', false)
    //         .order('datbi')

    //       let res = await systemDB.Query(sql.toParam())
    //       if (res.rowCount > 0) {
    //         // get latest date & knumb
    //         let { knumbLatest, dateByknumh } = getLatestKnumh(res.rows)
    //         // 時間區間內
    //         if (moment(date).unix() < moment(dateByknumh).unix()) {
    //           let sql_price = squel.select()
    //             .distinct()
    //             .field('bmatn', '"partNumber"')
    //             .field('a018.matnr')
    //             .field('datab')
    //             .field('cast( KBETR as numeric) / KPEIN ', '"unitPrice"')
    //             .field('kpein', 'unit')
    //             .field('konwa', 'currency')
    //             .field('MFRNR', 'manufacturer')
    //             .field('knumh')
    //             .from('wiprocurement.a018_konp', 'a018')
    //             .join('wiprocurement.eina', 'eina', 'eina.matnr = a018.matnr')
    //             .where('datbi = ? and a018.matnr = ? and knumh = ?  and LOEVM_KO is null ',
    //               dateByknumh, elm, knumbLatest)

    //           let res_price = await systemDB.Query(sql_price.toParam())
    //           if (res_price.rowCount > 0) {
    //             // console.log(res_price.rows[0])
    //             if (res_price.rows.length > 1) {
    //               // logger.warn('Error: ', res_price.rows)
    //             }
    //             return res_price.rows[0]
    //           } else {
    //             // logger.error('Error: ', dateByknumh, elm, knumbLatest, date)
    //           }
    //         } else {
    //           // logger.debug(`item: ${elm} , have no price. exp on ${dateByknumh}`)
    //         }

    //         // let sql_price = squel.select()
    //         //   .distinct()
    //         //   .field('bmatn', '"partNumber"')
    //         //   .field('a018.matnr')
    //         //   .field('datab')
    //         //   .field('cast( KBETR as numeric) / KPEIN ', '"unitPrice"')
    //         //   .field('kpein', 'unit')
    //         //   .field('konwa', 'currency')
    //         //   .field('MFRNR', 'manufacturer')
    //         //   .field('knumh')
    //         //   .from('wiprocurement.a018_konp', 'a018')
    //         //   .join('wiprocurement.eina', 'eina', 'eina.matnr = a018.matnr')
    //         //   .where('datbi = ? and a018.matnr = ? and knumh = ? and (datab <= ? and datbi >= ?) and LOEVM_KO is null ',
    //         //     dateByknumh, elm, knumbLatest, date, date)

    //         // let res_price = await systemDB.Query(sql_price.toParam())
    //         // if (res_price.rowCount > 0) {
    //         //   // console.log(res_price.rows[0])
    //         //   if (res_price.rows.length > 1) {
    //         //     // logger.warn('Error: ', res_price.rows)
    //         //   }
    //         //   return res_price.rows[0]
    //         // } else {
    //         //   logger.error('Error: ', dateByknumh, elm, knumbLatest, date)
    //         // }
    //       }
    //     }))

    //     resPromise.map(r => {
    //       if (!_.isEmpty(r)) {
    //         result.push(r)
    //       }
    //     })
    //     idx += pallelNum
    //   }
    //   return result
    // } else {
    //   logger.warn('cant found MPN part number', partNumbers)
    //   return []
    // }
  }

  static async getManufacturer(partNumbers) {
    let sql = squel.select()
      .distinct()
      .field('MFRNR', 'manufacturer')
      .field('matnr')
      .field('bmatn', '"partNumber"')
      .from(`${pgSchema}.eina`)
      .where('bmatn in ? AND MFRNR is not null AND MFRNR != \'\' AND LOEKZ is null AND LOEKZ != \'\' ', partNumbers)

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getUnitPrice(matnr, date) {

    let sql = squel.select()
      .distinct('matnr')
      .field('KONWA', 'currency')
      .field('cast( KBETR as numeric)', 'price')
      .field('KPEIN', 'unit')
      .field('matnr')
      .from(`${pgSchema}.a018_konp`)
      .where('matnr in ? AND (datab <= ? AND datbi >= ?) and LOEVM_KO is null', matnr, date, date)
      .order('matnr')
      .order('datab', false)

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getExchangeRate(date, currency) {
    let sql = squel
      .select()
      .distinct('fcurr')
      .field('GDATU', 'date')
      .field('fcurr')
      .field('(UKURS*TFACT/FFACT)', '"exchangeRate"')
      .from(`${pgSchema}.exchange_rate`)
      .where('GDATU <= ? AND fcurr in ? AND tcurr = \'USD\'', date, currency)
      .order('fcurr')
      .order('GDATU', false)

    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getVendorFilter() {
    let sql = squel.select().field('vendor_code').from(`${pgSchema}.vendor_filter`)
    const result = await systemDB.Query(sql.toParam())
    // console.log('vendor_filter is loaded:', result.rowCount)
    if (!result) return []
    else return result.rows
  }

  static async getMatnrByPN(pn) {
    let sql = squel
      .select()
      .distinct('matnr')
      .field('matnr')
      .from(`${pgSchema}.eina`)
      .where('bmatn = ?', pn)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getSPAPrice(pn) {
    let sql = squel
      .select()
      .from(`${pgSchema}.eedm_spa_price`)
      .where('partnumber = ?', pn)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getSupplyTypeMapping() {
    let sql = squel
      .select()
      .from(`${pgSchema}.supplytypemapping`)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getSupplyTypeByPN(pn) {
    let sql = squel
      .select()
      .distinct('eina.matnr')
      .field('eina.matnr', 'matnr')
      .field('marc.zzbsar', 'supply')
      .from(`${pgSchema}.eina`)
      .join(`${pgSchema}.marc`, 'marc', 'marc.matnr = eina.bmatn')
      .where('eina.bmatn = ?', pn)
      // .where('marc.datacflg = ?', 'Y')
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getManufacturerByPNPrice(pn) {
    let sql = squel.select()
      .field('p.manufacturer', 'manufacturer')
      .field('p.vendor_pn', 'vendor_part_no')
      .field('e.vbase', 'vendor')
      .field('partnumber', 'part_number')
      .field('purchaseorg')
      // .field('plant')
      .field('price', 'current_price')
      .from('wiprocurement.eedm_pn_price', 'p')
      .where('partnumber IN ?', [pn])
      .left_join('wiprocurement.epur_vgroup', 'e', 'e.vcode=p.vendor_code')
    let result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getA018PricebyPN(pn) {
    let sql = squel.select()
      .distinct()
      .field('bmatn', '"partNumber"')
      .field('a018.matnr')
      .field('datab')
      .field('datbi')
      .field('cast( KBETR as numeric) / KPEIN ', '"unitPrice"')
      .field('kpein', 'unit')
      .field('konwa', 'currency')
      .field('MFRNR', 'manufacturer')
      .field('knumh')
      .from('wiprocurement.a018_konp', 'a018')
      .join('wiprocurement.eina', 'eina', 'eina.matnr = a018.matnr and eina.lifnr = a018.lifnr')
      .where(' eina.bmatn = ? ', pn)
    let result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async getPurchasingOrgByPN(pn) {
    let sql = `select detail.part_number,proj.purchasing_organization,detail.current_price, proj.project_name, detail.update_time from wiprocurement.eebom_detail as detail
    join wiprocurement.edm_version as ver on detail.edm_version_id=ver.id
    join wiprocurement.eebom_projects as proj on ver.eebom_project_id=proj.id
    where part_number='${pn}'
    `
    let result = await systemDB.Query(sql)
    return result.rows
  }
}

module.exports = SPA
