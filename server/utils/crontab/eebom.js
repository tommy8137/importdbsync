const _ = require('lodash')
let squel = require('squel').useFlavour('postgres')
const moment = require('moment-timezone')
const { systemDB } = require('../../helpers/database')
const dbHelper = require('../../helpers/db_helper')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('eeBomCrontab')
const lpp = require('../../service/lpp.js')
const { lppConfig } = require('../../../config.js')
const commonCalculate = require('../common/calculate.js')
const commonUtil = require('../common/utils.js')
const commonLogical = require('../common/logical.js')
const pcbCrontab = require('./pcb.js')

// DETAIL_COLS for refresh
const DETAIL_COLS = [
  'obs',
  // 'edm_version_id',
  // 'part_number',
  'description',
  'board',
  'eedm_description',
  'reference',
  'module',
  'qty',
  'spa',
  'other_manufacture_info',
  'type1',
  'type2',
  'supply_type',
  'manufacturer',
  'vendor_part_no',
  'vendor',
  'current_price',
  'lowest_price',
  'second_highest_price',
  'sheet',
  'update_time',
  'valid_from',
  'lowest_price_valid_from',
  'second_highest_price_valid_from',
  'exp_spa',
  'exp_other_manufacture_info',
  'spa_expire',
  'is_common_parts',
  'last_price_currency_price',
  'last_price_currency',
  'lowest_price_currency_price',
  'lowest_price_currency',
  'second_highest_price_currency_price',
  'second_highest_price_currency',
  'alt_lowest_price',
  'alt_lowest_partnumber',
  'alt_manufacturer',
  'alt_grouping',
  'alt_other_info',
  'current_price_exp',
  'avl_spa',
  'avl_spa_other_info',
  'avl_alt',
  'avl_alt_other_info',
  'avl_spa_bolder',
  'avl_alt_bolder',
  'avap',
  'supply_type_diff',
  'supply_type_list',
  'alt_lowest_price_without_main_pn',
  'alt_lowest_partnumber_without_main_pn',
  'alt_manufacturer_without_main_pn',
  // 'alt_grouping_without_main_pn',
  'alt_other_info_without_main_pn',
  'avl_alt_without_main_pn',
  'avl_alt_other_info_without_main_pn',
  'avl_alt_bolder_without_main_pn',
]

/**
 * 將Array等分的切開
 * @param {array} myArray array資料
 * @param {integer} chunk_size 切割的size
 */
const chunkArray = (myArray, chunk_size) => {
  let index = 0
  let arrayLength = myArray.length
  let tempArray = []

  for (index = 0; index < arrayLength; index += chunk_size) {
    let myChunk = myArray.slice(index, index + chunk_size)
    // Do something if you want with the group
    tempArray.push(myChunk)
  }
  return tempArray
}


/**
 * 將array元素依序丟進去asyncFunc裡面執行
 * @param {array} array 參數function
 * @param {function} asyncFunc 非同步的function
 */
const asyncForEach = async (array, asyncFunc) => {
  for (let index = 0; index < array.length; index++) {
    await asyncFunc(array[index], index)
  }
}
const convertSupplyTypeToNumber = (info, supplyTyeInfo) =>{
  for(let supplyType of supplyTyeInfo) {
    if(info == supplyType.supply_type){
      return supplyType.key
    }
  }
  return null
}
const getEdmVersions = async()=> {
  let sql = squel.select()
    .field('id', 'id')
    .from('wiprocurement.edm_version')
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const getAllEebomDetail = async(edm_version_id)=> {
  let sql = squel.select()
    .field('*')
    .from('wiprocurement.view_eebom_detail')
    .where('edm_version_id = ?', edm_version_id)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const getMarcInfo = async(partNumbers) =>{
  let sql = squel.select()
    .field('matnr', 'part_number')
    .field('werks', 'plant')
    .field('prctr', 'profit_center')
    .field('zzbsar', 'supply_type')
    .from('wiprocurement.marc')
    .where('matnr in ?', partNumbers)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const getSupplyTypeMapping = async()=> {
  let sql = squel.select()
    .field('supply_type', 'supply_type')
    .field('key', 'key')
    .from('wiprocurement.supplytypemapping')
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const insertLpp = async(src)=> {
  let sql = squel.update().table('wiprocurement.eebom_detail')
  if(src.lpp != null && src.lpp != undefined) sql.set('lpp', src.lpp)
  sql.where('id =?', src.id)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const updateEEBomRefreshTime = async(version_ids)=> {
  let sql = squel.update().table('wiprocurement.edm_version')
  sql.set('refresh_time', 'now()')
  sql.where('id in ?', version_ids)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}
const getLpp = async(partNumbers, bomDetailInfos) => {
  let marcInfos = await getMarcInfo(partNumbers)
  let supplyTypeMapping = await getSupplyTypeMapping()
  let bomDetailInfoTmp = []
  let tmp
  for(let i = 0; i < bomDetailInfos.length ;i++) {
    if((i + 1) % lppConfig.testTimes != 0) {
      bomDetailInfoTmp.push(bomDetailInfos[i])
    }
    if ((i + 1) % lppConfig.testTimes == 0 || (i + 1) == bomDetailInfos.length){
      bomDetailInfoTmp.push(bomDetailInfos[i])
      tmp = { input:[] }
      for (let info of bomDetailInfoTmp) {
        let supplyType = convertSupplyTypeToNumber(info.supply_type, supplyTypeMapping)
        for(let marc of marcInfos) {
          if(marc.part_number == info.part_number && marc.supply_type == supplyType) {
            tmp.input.push({
              'wistron p/n': info.part_number,
              'Profit_Center': marc.profit_center,
              'Manufacturer': info.manufacturer,
              'Supply_Type': supplyType,
            })
          }
        }
      }
      try{
        let start = new Date()
        let results = await lpp.getLppModule(tmp)
        let dura_sec = (new Date() - start) / 1000
        logger.info(`query lpp R ${dura_sec} sec`)
        for(let info of bomDetailInfoTmp) {
          for (let lpp of results) {
            if(lpp.reason == 'NOTINLPPRANGE' && info.part_number == lpp.part_number) {
              console.log('NOTINLPPRANGE')
              info.lpp = null
              break
            }
            if(lpp.price != 'NA'  && info.part_number == lpp.part_number) {
              if(typeof info.lpp == 'undefined' || info.lpp == null ) info.lpp = lpp.price
              else if(info.lpp > lpp.price) info.lpp = lpp.price
            }
          }

          if(info.lpp != null) {
            logger.info('query lpp')
            await insertLpp(info)
          }
        }
      }catch(er){
        console.log(er)
      }
      bomDetailInfoTmp = []
    }
  }
  return true
}
/**
 *
 * @param {Array} version_id
 * @param {Booleans} isGroupPcbBoard 是否要包含pcbBomItem的相關資訊
 */
const getBomItems = async(version_id, isGroupPcbBoard = false) =>{
  let sql = squel.select()
    .field('ver.id', 'edm_version_id')
    .field('project.plant', 'plant')
    .field('project.purchasing_organization', 'purchaseorg')
    .field('project.plant_code', 'plantcode')
    .field('item.partnumber', 'part_number')
    .field('item.description', 'eedm_description')
    .field('item.reference', 'reference')
    .field('item.bymodule', 'module')
    .field('item.board', 'board')
    .field('item.sheet', 'sheet')
    .field('qty')
    .field('avap', 'eedm_avap')
    .field('customer')
    .field('product_type')
    .from('wiprocurement.edm_version', 'ver')

  if (version_id && version_id.length > 0) {
    logger.debug('eebom detail on update these versions', version_id)
    sql.where('ver.id IN ?', version_id)
  } else {
    logger.debug('execute all versions', version_id)
  }
  const groupPartNumberSql = squel.select()
    .field('COUNT(*) ', 'qty')
    .field('partnumber')
    // .field('MAX(description)', 'description')
    .field('MAX(description)', 'description')
    .field('MAX(reference)', 'reference')
    .field('MAX(bymodule)', 'bymodule')
    .field('table_name')
    .field('MAX(sheet)', 'sheet')
    .field('MAX(avap)', 'avap')
    .from('wiprocurement.eedm_bom_item')
    .group('table_name')
    // .group('board')
    // .group('partnumber'), 'item', 'item.table_name = ver.version')
    .group('partnumber')
  if(isGroupPcbBoard){
    sql.field('item.board', 'board')
    groupPartNumberSql.field('board')
    groupPartNumberSql.group('board')
  } else {
    groupPartNumberSql.field('MAX(board)', 'board')
  }
  sql.left_join('wiprocurement.eebom_projects', 'project', 'project.id=ver.eebom_project_id')
    .join(groupPartNumberSql, 'item', 'item.table_name = project.pcbno||\'_\'||project.stage||\'_\'||project.sku||\'_\'||ver.version')

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getSPAPrice = async(allPartNums) =>{
  let sql = squel.select()
    .field('spa.spa_price', 'spa')
    .field('spa.spa_partnumber', 'spa_partnumber')
    .field('spa.manufacturer', 'spa_manufacturer')
    .field('partnumber', 'part_number')
    .field('spa.exp_spa_price', 'exp_spa')
    .field('spa.exp_spa_partnumber', 'exp_spa_partnumber')
    .field('spa.exp_manufacturer', 'exp_spa_manufacturer')
    .field('spa.original_currency', 'original_currency')
    .field('spa.original_spa_price', 'original_spa_price')
    .field('to_char(expire_time, \'YYYY-MM-DD\')', 'spa_expire_date')
    .field('to_char(valid_from, \'YYYY-MM-DD\')', 'spa_valid_from')
    .field('spa.similar_info', 'spa_similar_info')

    .from('wiprocurement.eedm_spa_price', 'spa')
    .where('partnumber IN ?', allPartNums)

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberDescription = async(allPartNums) =>{
  let sql = squel.select()
    .field('maktx', 'description')
    .field('matnr', 'part_number')
    .from('wiprocurement.mara')
    .where('matnr IN ?', allPartNums)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberTypes = async(allPartNums) =>{
  let sql = squel.select()
    .field('type1.type1name', 'type1')
    .field('type2.type2name', 'type2')
    .field('type.item', 'part_number')
    .from('wiprocurement.epur_itemtype', 'type')
    .left_join('wiprocurement.epur_type1', 'type1', 'type.type1id=type1.type1id')
    .left_join('wiprocurement.epur_type2', 'type2', 'type.type2id=type2.type2id')
    .where('type.item IN ?', allPartNums)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberSpec = async(allPartNums) =>{
  let sql = squel.select()
    .field('spec1', 'spec01').field('spec2', 'spec02').field('spec3', 'spec03').field('spec4', 'spec04').field('spec5', 'spec05')
    .field('spec6', 'spec06').field('spec7', 'spec07').field('spec8', 'spec08').field('spec9', 'spec09').field('spec10')
    .field('spec11').field('spec12').field('spec13').field('spec14').field('spec15')
    .field('spec16').field('spec17').field('spec18').field('spec19').field('spec20')
    .field('spec21').field('spec22').field('spec23').field('spec24').field('spec25')
    .field('spec26').field('spec27').field('spec28').field('spec29').field('spec30')
    .field('item')
    .from('wiprocurement.epur_itemspec', 'spec')
    .where('spec.item IN ?', allPartNums)

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberPlantAndSupplyType = async(allPartNums) =>{
  /*
    SELECT marc.werks AS plant, item.supply_type AS supply_type, marc.matnr AS part_number
      FROM wiprocurement.marc AS marc
        INNER JOIN (
	        SELECT key, MAX(supply_type) AS supply_type FROM wiprocurement.supplytypemapping GROUP BY key
        ) AS item ON (marc.zzbsar = item.key)
      WHERE (matnr IN ('022.10006.0371'));
    */
  let sql = squel.select()
    .field('marc.werks', 'plant')
    .field('item.supply_type', 'supply_type')
    .field('marc.matnr', 'part_number')
    .from('wiprocurement.marc', 'marc')
    .where('matnr IN ?', allPartNums)
    .join(squel.select()
      .field('key')
      .field('MAX(supply_type)', 'supply_type')
      .from('wiprocurement.supplytypemapping')
      .group('key'), 'item', 'marc.zzbsar = item.key')

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberHighestPrice = async(allPartNums) =>{
  let sql = squel.select()
    .field('p.manufacturer', 'last_price_manufacturer')
    .field('p.vendor_pn', 'last_price_vendor_part_no')
    .field('e.vbase', 'last_price_vendor')
    .field('partnumber', 'part_number')
    .field('purchaseorg')
    .field('valid_from')
    .field('price', 'current_price')
    .field('currency_price', 'last_price_currency_price')
    .field('currency', 'last_price_currency')
    .from('wiprocurement.eedm_pn_price', 'p')
    .where('partnumber IN ?', allPartNums)
    .left_join('wiprocurement.epur_vgroup', 'e', 'e.vcode=p.vendor_code')
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberLowestPrice = async(allPartNums) =>{
  let sql = squel.select()
    .field('p.manufacturer', 'manufacturer')
    .field('p.vendor_pn', 'vendor_part_no')
    .field('e.vbase', 'vendor')
    .field('partnumber', 'part_number')
    .field('purchaseorg')
    .field('valid_from', 'lowest_price_valid_from')
    .field('price', 'lowest_price')
    .field('currency_price', 'lowest_price_currency_price')
    .field('currency', 'lowest_price_currency')
    .from('wiprocurement.eedm_pn_lowest_price', 'p')
    .where('partnumber IN ?', allPartNums)
    .left_join('wiprocurement.epur_vgroup', 'e', 'e.vcode=p.vendor_code')
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumber2ndHighestPrice = async(allPartNums) =>{
  let sql = squel.select()
    // .field('p.manufacturer', 'manufacturer')
    // .field('p.vendor_pn', 'vendor_part_no')
    // .field('e.vbase', 'vendor')
    .field('partnumber', 'part_number')
    .field('purchaseorg')
    .field('valid_from', 'second_highest_price_valid_from')
    .field('price', 'second_highest_price')
    .field('currency_price', 'second_highest_price_currency_price')
    .field('currency', 'second_highest_price_currency')
    .from('wiprocurement.eedm_pn_2nd_highest_price', 'p')
    .where('partnumber IN ?', allPartNums)
    .left_join('wiprocurement.epur_vgroup', 'e', 'e.vcode=p.vendor_code')
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getPartNumberLifeCycle = async(allPartNums) =>{
  let sql = squel.select()
    .field('lifecyclestate')
    .field('partnumber', 'part_number')
    .from('wiprocurement.pdmparts')
    .where('partnumber IN ?', allPartNums)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getCommonPart = async(allPartNums) =>{
  let sql = squel.select()
    .field('partnumber', 'part_number')
    .from('wiprocurement.view_common_parts')
    .where('partnumber IN ?', allPartNums)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getAltPrice = async(allPartNums) =>{
  let sql = squel.select()
    .field('item_num', 'part_number')

    .field('alt_num', 'alt_lowest_partnumber')
    .field('lowest_price', 'alt_lowest_price')
    .field('manufacturer', 'alt_manufacturer')
    .field('vendor_pn', 'alt_vendor_pn')

    .field('grouping', 'alt_grouping_list')

    .field('currency', 'alt_currency')
    .field('origin_lowest_price', 'alt_origin_lowest_price')
    .field('origin_currency', 'alt_origin_currency')
    .field('to_char(valid_from, \'YYYY-MM-DD\')', 'alt_valid_from')

    .field('similar_info', 'alt_similar_info')

    .field('alt_num_without_main_pn', 'alt_lowest_partnumber_without_main_pn')
    .field('lowest_price_without_main_pn', 'alt_lowest_price_without_main_pn')
    .field('manufacturer_without_main_pn', 'alt_manufacturer_without_main_pn')
    .field('vendor_pn_without_main_pn', 'alt_vendor_pn_without_main_pn')


    .field('currency_without_main_pn', 'alt_currency_without_main_pn')
    .field('origin_lowest_price_without_main_pn', 'alt_origin_lowest_price_without_main_pn')
    .field('origin_currency_without_main_pn', 'alt_origin_currency_without_main_pn')
    .field('to_char(valid_from_without_main_pn, \'YYYY-MM-DD\')', 'alt_valid_from_without_main_pn')

    .field('similar_info_without_main_pn', 'alt_similar_info_without_main_pn')

    .from('wiprocurement.sapalt_price')
    .where('item_num IN ?', allPartNums)

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getEEBOMDetailOnConflictSql = () =>{
  let onConflictClause = ' ON CONFLICT ("part_number", "edm_version_id") DO UPDATE SET '
  DETAIL_COLS.forEach((c, idx) => {
    if (idx == DETAIL_COLS.length - 1) {
      onConflictClause += `${c}=EXCLUDED.${c}`
    } else {
      onConflictClause += `${c}=EXCLUDED.${c}, `
    }
  })
  return onConflictClause
}
const getCurrentPriceExpire  = async(partNumber, ekorg) =>{
  let sql = squel.select()
    .field('bmatn')
    .field('ekorg')
    .field('datbi')
    .from('wiprocurement.sap_info_record')
    .where('bmatn = ? and ekorg = ?', partNumber, ekorg)
  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

/**
 * 依造purchase org 的順序取出 對應的 價錢
 * @param {*} plantCode 使用者在系統中排序的 plant & purchase org ex: [
      {"purchasing_organization":"PWCD","plants":["F721"]},
      {"purchasing_organization":"PWKS","plants":["F232"]},
    ]
 * @param {*} pricePair 料號的價格列表 ex: [
   { part_number: '123.000123.123', purchaseorg: 'PWKS', price: 1 },
   { part_number: '123.000123.123', purchaseorg: 'PWZS', price: 2 },
  ]
 * @param {*} part_number 料號
 *
 * @returns {Object} ex: { part_number: '123.000123.123', "purchaseorg":"PWKS","price": 1 },
 */
const priceByPerferredOrder = (plantCode, pricePair, part_number) => {
  // logger.debug('priceByPerferredOrder', plantCode, pricePair, part_number)

  for (let i = 0; i < plantCode.length; i++) {
    let inOrderArr = _.find(pricePair, { part_number: part_number, purchaseorg: plantCode[i].purchasing_organization })
    if (inOrderArr) {
      return (inOrderArr)
    }
  }
}
/**
 * 依造plnat 的順序取出 對應的 marc資料
 *
 * @param {*} plants purchase org的plants ex: ['F721', 'F130']
 * @param {*} marcValPair 料號的資訊列表 ex: [
   { part_number: '123.000123.123', supplt_type: 'W', plant: 'F721' },
   { part_number: '123.000123.123', supplt_type: 'AV', plant: 'F130' },
  ]
 * @param {*} part_number 料號
 *
 * @returns {Object} ex: { part_number: '123.000123.123', supplt_type: 'W', plant: 'F721' },
 */
const plantByPerferredOrder = (plants, marcValPair, part_number) => {
  // logger.debug('plantByPerferredOrder', plant, marcValPair, part_number)

  for (let i = 0; i < plants.length; i++) {
    let inOrderArr = _.find(marcValPair, { part_number: part_number, plant: plants[i] })
    if (inOrderArr) {
      return (inOrderArr)
    }
  }

}

const supplyTypePerferredOrder = ['W', 'AV', 'S', 'A', 'B', 'C', null]
/**
 * 根據 CE提供的順序 W → AV → S → A → B → C → empty, 取出supply type
 * @param {*} arr
 * @param {*} supplyTypeKey
 */
const supplyTypeByPerferredOrder = (arr, supplyTypeKey) => {
  for (let i = 0; i < supplyTypePerferredOrder.length; i++){
    let inOrderArr = _.find(arr, (a) => a[supplyTypeKey] == supplyTypePerferredOrder[i])
    if(inOrderArr) {
      return (inOrderArr)
    }
  }
  return null
}

const getAvlList = async() => {
  let sql = squel.select()
    .field('customer', 'avl_customer')
    .field('type1', 'avl_type1')
    .field('type2', 'avl_type2')
    .field('bu', 'avl_bu')
    .field('brand', 'avl_brand')
    .field('spec', 'avl_spec')
    .from('wiprocurement.eebom_avl')

  let result = await systemDB.Query(sql.toParam())
  return result.rowCount > 0 ?  result.rows : []
}

const getMatchAvlList = async (similarInfo, avlPair) => {
  // let similarInfo = item.similar_info
  let avlBrands = _.map(_.uniq(_.flatten(_.map(avlPair, 'avl_brand'))), (b) => b.toLowerCase())

  // 先過濾 manufacturer不在avl 條件中的 similar info
  let similarByBrand = _.filter(similarInfo, (s) => avlBrands.includes(s.manufacturer.toLowerCase()))
  let similarBySpec = []

  if (similarByBrand.length > 0) {
    let specList = await getPartNumberSpec(_.uniq(_.map(similarByBrand, 'partNumber')))

    similarBySpec = _.map(similarByBrand, (similar) => {
      let specPair = _.find(specList, { item: similar.partNumber })
      similar.matchAvl = false

      if (specPair) {
        similar = {
          ...similar,
          ...specPair,
        }

        let avlMeetBrands = _.filter(avlPair, (avl) => _.map(_.get(avl, 'avl_brand'), (b) => b.toLowerCase())
          .includes(similar.manufacturer.toLowerCase()))

        let match = false
        // 判斷符合 相似料號的 spec 是否 avl spec條件
        avlMeetBrands.some((avl) => {
          let avl_spec = avl.avl_spec
          if (Object.keys(avl_spec).length > 0) {
            match = determineSpec(similar, avl_spec)
            return match
          } else {
            // avl spec 為空時, 代表 符合條件 不需判斷
            match = true
            return true
          }
        })

        similar.matchAvl = match
        return similar
      }
      return similar
    })

    // 過濾掉 不match的資料
    return similarBySpec.filter(s => s.matchAvl)
  }

  return []
}

const determineSpec = (spaSimilarItem, specCondition) => {
  let flag = []

  _.forEach(Object.keys(specCondition), (specKey) => {
    let spec = specCondition[specKey].trim().split(/([<>=]+)/).filter(e => e)
    let specSymbol = spec.filter(Number)[0]
    let specNumber = spec.filter(Boolean)[0]

    if (spaSimilarItem[specKey.toLowerCase()]) {
      switch (specSymbol) {
        case '>=':
          spaSimilarItem[specKey.toLowerCase()] >= specNumber ? flag.push(true) : flag.push(false)
          break
        case '<=':
          spaSimilarItem[specKey.toLowerCase()] <= specNumber ? flag.push(true) : flag.push(false)
          break
        case '>':
          spaSimilarItem[specKey.toLowerCase()] > specNumber ? flag.push(true) : flag.push(false)
          break
        case '<':
          spaSimilarItem[specKey.toLowerCase()] < specNumber ? flag.push(true) : flag.push(false)
          break
        default:
          spaSimilarItem[specKey.toLowerCase()].toUpperCase() == specNumber.toUpperCase() ? flag.push(true) : flag.push(false)
          break
      }
    } else {
      flag.push(false)
    }

  })
  // 如果有false, 代表 不符合alt 要求
  return !flag.includes(false)
}
const determinePrice = (type, lowestPrice, secondHighestPrice, price) => {

  if(type == 'RES' && price) {
    secondHighestPrice = {
      'second_highest_price': price.current_price,
      'second_highest_price_currency_price': price.last_price_currency_price,
      'second_highest_price_currency': price.last_price_currency,
      'second_highest_price_valid_from': price.valid_from,
    }
    lowestPrice = {
      'lowest_price': price.current_price,
      'lowest_price_currency_price': price.last_price_currency_price,
      'lowest_price_currency': price.last_price_currency,
      'lowest_price_valid_from': price.valid_from,
      'manufacturer': price.last_price_manufacturer,
      'vendor_part_no': price.last_price_vendor_part_no,
      'vendor': price.last_price_vendor,
    }
  } else if (type == 'OTHERS' && lowestPrice) {
    secondHighestPrice = {
      'second_highest_price': lowestPrice.lowest_price,
      'second_highest_price_currency_price': lowestPrice.lowest_price_currency_price,
      'second_highest_price_currency': lowestPrice.lowest_price_currency,
      'second_highest_price_valid_from': lowestPrice.lowest_price_valid_from,
    }
    price = {
      'current_price': lowestPrice.lowest_price,
      'last_price_currency_price': lowestPrice.lowest_price_currency_price,
      'last_price_currency': lowestPrice.lowest_price_currency,
      'valid_from': lowestPrice.lowest_price_valid_from,
    }
  }

  return {
    lowestPrice,
    secondHighestPrice,
    price,
  }
}

const processEEBomItems = async (item_info, price_info) =>{

  let eeBomItems = item_info.eeBomItems
  let maraValPair = item_info.maraValPair
  let cbgValPair = item_info.cbgValPair
  let marcValPair = item_info.marcValPair
  let pdmpartsPair = item_info.pdmpartsPair
  let commonPartsPair = item_info.commonPartsPair
  let avlListPair = item_info.avlListPair

  let pricePair = price_info.pricePair
  let lowestPricePair = price_info.lowestPricePair
  let secondHighestPricePair = price_info.secondHighestPricePair
  let spaPair = price_info.spaPair
  let altPricePair = price_info.altPricePair

  _.map(eeBomItems, async function (obj) {
    let cbg = _.find(cbgValPair, { part_number: obj.part_number })
    if (typeof (cbg) != 'undefined') {
      cbg['type1'] = cbg['type1'] || '<NULL>'
    } else {
      cbg = { 'type1': '<NULL>' }
    }

    // 2020-sprint29 price 不根據 project 的 purchaseorg 做選擇, supply type如果有多個 用supply_type_diff標記

    // 2020-sprint23 修改 price 要依造user 選擇的purchaseorg 順序 調整價格與supply type,
    // 若為新接進來的 project 則使用原本的規則 purchase_org, plant 取價格與supply_type
    let price = {}, marcItem = {}, lowestPrice = {}, secondHighestPrice = {}

    price = _.find(pricePair, { part_number: obj.part_number })
    lowestPrice = _.find(lowestPricePair, { part_number: obj.part_number })
    secondHighestPrice = _.find(secondHighestPricePair, { part_number: obj.part_number })

    // 處理 supply type
    let supplyTypeList = _.filter(marcValPair, { part_number: obj.part_number })
    let supplyTypeUniq = _.uniq(_.map(supplyTypeList, 'supply_type'))
    obj.supply_type_list = JSON.stringify(supplyTypeUniq)
    obj.supply_type_diff = supplyTypeUniq.length > 1 ? true : false
    marcItem = supplyTypeByPerferredOrder(supplyTypeList, 'supply_type')

    // sprint 32 分為三類 MLCC, RES, Others
    //           RES 只有最高價, 第二高價與最低價, 使用最高價取代
    //           Others 只有最低價, 第二高價與最高價, 使用最低價取代
    let pn_type = commonLogical.determineType(obj.part_number, cbg.type1, cbg.type2)
    let priceBytype = determinePrice(pn_type, lowestPrice, secondHighestPrice, price)

    // sprint 26 若 MLCC第二高價 沒有 價格 則使用 最低價
    // if (!secondHighestPrice && lowestPrice) {
    //   secondHighestPrice = {
    //     'second_highest_price': lowestPrice.lowest_price,
    //     'second_highest_price_currency_price': lowestPrice.lowest_price_currency_price,
    //     'second_highest_price_currency': lowestPrice.lowest_price_currency,
    //     'second_highest_price_valid_from': lowestPrice.lowest_price_valid_from,
    //   }
    // }

    // 2020-sprint29 移除下述規則, eebom新增AVAP欄位, AVAP欄位為 AVAP或Remove時 呈現Y
    // 2020-sprint23 AVAP List 中，AVAP 及 Remove 的料 Supply type 改為A
    if ((obj.eedm_avap) && (obj.eedm_avap.toLowerCase() == 'avap' || obj.eedm_avap.toLowerCase() == 'remove')) {
      obj.avap = 'Y'
    } else {
      obj.avap = 'N'
    }

    let spa = _.find(spaPair, { part_number: obj.part_number })
    if (typeof (spa) != 'undefined') {
      spa['other_manufacture_info'] = JSON.stringify({
        spa_partnumber: spa.spa_partnumber,
        spa_manufacturer: spa.spa_manufacturer,
        original_currency: spa.original_currency,
        original_spa_price: spa.original_spa_price,
        spa_valid_from: spa.spa_valid_from,
      })
      spa['exp_other_manufacture_info'] = JSON.stringify({ spa_partnumber: spa.exp_spa_partnumber, spa_manufacturer: spa.exp_spa_manufacturer })
      spa['spa_expire'] = spa.spa_expire_date ? moment(new Date()).format('YYYY-MM-DD') > spa.spa_expire_date ? 'Y' : 'N' : null
    }



    let mara = _.find(maraValPair, { part_number: obj.part_number })

    // 201910 新增alt price
    let altItem = _.find(altPricePair, { part_number: obj.part_number })
    if (typeof (altItem) != 'undefined') {

      altItem['alt_grouping'] = JSON.stringify(altItem.alt_grouping_list)
      altItem['alt_other_info'] = JSON.stringify({
        currency: altItem.alt_currency,
        origin_currency: altItem.alt_origin_currency,
        origin_lowest_price: altItem.alt_origin_lowest_price,
        valid_from: altItem.alt_valid_from,
        vendor_pn: altItem.alt_vendor_pn,
      })

      if (altItem.alt_lowest_partnumber_without_main_pn) {
        // altItem['alt_grouping_without_main_pn'] = JSON.stringify(_.without(altItem.alt_grouping_list, obj.part_number))
        altItem['alt_other_info_without_main_pn'] = JSON.stringify({
          currency: altItem.alt_currency_without_main_pn,
          origin_currency: altItem.alt_origin_currency_without_main_pn,
          origin_lowest_price: altItem.alt_origin_lowest_price_without_main_pn,
          valid_from: altItem.alt_valid_from_without_main_pn,
          vendor_pn: altItem.alt_vendor_pn_without_main_pn,
        })
      }
    }

    let res = _.assign(obj,
      priceBytype.price,
      priceBytype.lowestPrice,
      priceBytype.secondHighestPrice,
      marcItem,
      spa,
      cbg,
      mara,
      altItem,
    )

    let pdmpartsItem = _.find(pdmpartsPair, { part_number: obj.part_number })
    if (pdmpartsItem && pdmpartsItem.lifecyclestate == 'LcsObsoleted') {
      res['obs'] = 'Y'
    } else {
      res['obs'] = 'N'
    }


    res['id'] = `${obj.edm_version_id}-${obj.part_number}`
    res['update_time'] = moment().utc().format()
    res['valid_from'] = res['valid_from'] == null ? null : moment(res['valid_from']).tz('Asia/Taipei').format('YYYY-MM-DD')
    res['lowest_price_valid_from'] = res['lowest_price_valid_from'] == null ? null : moment(res['lowest_price_valid_from']).tz('Asia/Taipei').format('YYYY-MM-DD')
    res['second_highest_price_valid_from'] = res['second_highest_price_valid_from'] == null ? null : moment(res['second_highest_price_valid_from']).tz('Asia/Taipei').format('YYYY-MM-DD')


    // check is common parts
    let commonPartsItem = _.find(commonPartsPair, { part_number: obj.part_number })
    res['is_common_parts'] = commonPartsItem != undefined ? true : false

    // 2019.11.15 新增 remark for Suggestion Cost 判斷
    // 2020.04.07 sprint 26 調整 Suggestion Cost 邏輯 將此判斷註解
    // if ((res['type1'].toLowerCase() == 'res' && res['type2'].toLowerCase() != 'thermistor') ||
    //   res['type1'].toLowerCase() == 'mlcc' && res['type2'].toLowerCase() != 'dip') {
    //   res['remark'] = 'Keep Org. P/N & Last Price, Same P/N multiple sources'
    // } else {
    //   res['remark'] = null
    // }

    return res
  })
  // check price has expire price, 如果 current_price 是空的 代表 沒有最新的維護價格, 再去找 這個料號是否有過期的價格, 用以判斷"存在過期價格"
  for (let obj of eeBomItems) {
    if(obj['lowest_price'] == null || typeof obj['lowest_price'] == 'undefined') {
      let expirePartNumberInfos = await getCurrentPriceExpire(obj.part_number, obj.purchaseorg)
      let findResult = _.find(expirePartNumberInfos, { 'bmatn': obj.part_number, 'ekorg': obj.purchaseorg })
      obj['current_price_exp'] = _.isEmpty(findResult) ? 'N' : 'Y'
    } else {
      obj['current_price_exp'] = 'N'
    }

    // 2020-sprint23 AVL_SPA, AVL_ALT
    let avlPair = _.filter(avlListPair, (avl) => {
      return obj.type1 && obj.type2 &&
        avl.avl_customer.toUpperCase() == obj.customer.toUpperCase() &&
        avl.avl_bu.toUpperCase() == obj.product_type.toUpperCase() &&
        avl.avl_type1.toUpperCase() == obj.type1.toUpperCase() &&
        (avl.avl_type2 == null || avl.avl_type2.toUpperCase() == obj.type2.toUpperCase())
    })


    // 判斷 spa
    if (typeof (obj.spa) != 'undefined'){
      // 依據 customer, bu 以及 type1, 找到的 avl
      if(avlPair && avlPair.length > 0 && obj.spa_similar_info && obj.spa_similar_info.length > 0) {

        let similarByAvl = await getMatchAvlList(obj.spa_similar_info, avlPair)
        // 有找到符合AVL 的相似料號
        if(similarByAvl.length > 0) {
          // 找到最低價
          let spa_result = await commonCalculate.getSpaMinPrice(similarByAvl)

          obj.avl_spa = spa_result.spa_price
          obj.avl_spa_other_info = JSON.stringify({
            spa_partnumber: spa_result.spa_partnumber,
            spa_manufacturer: spa_result.manufacturer,
            original_currency: spa_result.original_currency,
            original_spa_price: spa_result.original_spa_price,
            spa_valid_from: spa_result.valid_from,
          })
          obj.avl_spa_bolder = true
        }
      } else {
        obj.avl_spa = obj.spa
        obj.avl_spa_other_info = obj.other_manufacture_info
        obj.avl_spa_bolder = false
      }
    }

    // alt
    if (typeof (obj.alt_lowest_price) != 'undefined') {
      if(avlPair && avlPair.length > 0 && obj.alt_similar_info && obj.alt_similar_info.length > 0) {
        let similarByAvl = await getMatchAvlList(obj.alt_similar_info, avlPair)
        // 有找到符合AVL 的相似料號
        if(similarByAvl.length > 0) {
          // 找到最低價
          let alt_result = await commonCalculate.getAltMinPrice(similarByAvl)

          // 符合AVL 條件的 alt 資料
          obj.avl_alt = alt_result.lowest_price
          obj.avl_alt_other_info = JSON.stringify({
            alt_manufacturer: alt_result.manufacturer,
            alt_lowest_partnumber: alt_result.alt_num,
            origin_currency: alt_result.origin_currency,
            origin_lowest_price: alt_result.origin_lowest_price,
            valid_from: alt_result.valid_from,
            vendor_pn: alt_result.vendor_pn,
          })
          obj.avl_alt_bolder = true
        }
      } else {
        // 沒有符合AVL 條件的 alt 資料, 則用alt 最低價
        obj.avl_alt = obj.alt_lowest_price
        obj.avl_alt_other_info = JSON.stringify({
          ...JSON.parse(obj.alt_other_info),
          alt_manufacturer: obj.alt_manufacturer,
          alt_lowest_partnumber: obj.alt_lowest_partnumber,
        })
        obj.avl_alt_bolder = false
      }
    }

    if (typeof (obj.alt_lowest_price_without_main_pn) != 'undefined') {
      if(avlPair && avlPair.length > 0 && obj.alt_similar_info_without_main_pn && obj.alt_similar_info_without_main_pn.length > 0) {
        let similarByAvl = await getMatchAvlList(obj.alt_similar_info_without_main_pn, avlPair)
        // 有找到符合AVL 的相似料號
        if(similarByAvl.length > 0) {
          // 找到最低價
          let alt_result = await commonCalculate.getAltMinPrice(similarByAvl, obj.part_number)
          if (alt_result) {
            // 符合AVL 條件的 alt 資料
            obj.avl_alt_without_main_pn = alt_result.lowest_price
            obj.avl_alt_other_info_without_main_pn = JSON.stringify({
              alt_manufacturer: alt_result.manufacturer,
              alt_lowest_partnumber: alt_result.alt_num,
              origin_currency: alt_result.origin_currency,
              origin_lowest_price: alt_result.origin_lowest_price,
              valid_from: alt_result.valid_from,
              vendor_pn: alt_result.vendor_pn,
            })
            obj.avl_alt_bolder_without_main_pn = true
          }
        }
      } else {
        // 沒有符合AVL 條件的 alt 資料, 則用alt 最低價
        if (obj.alt_lowest_price_without_main_pn) {
          obj.avl_alt_without_main_pn = obj.alt_lowest_price_without_main_pn
          obj.avl_alt_other_info_without_main_pn = JSON.stringify({
            ...JSON.parse(obj.alt_other_info_without_main_pn),
            alt_manufacturer: obj.alt_manufacturer_without_main_pn,
            alt_lowest_partnumber: obj.alt_lowest_partnumber_without_main_pn,
          })
          obj.avl_alt_bolder_without_main_pn = false
        }
      }
    }
  }



  _.flatMap(eeBomItems, (item) => {
    DETAIL_COLS.forEach(c => {
      if (!(c in item)) {
        item[c] = null
      }
    })
    // if (Object.keys(item).length != Object.keys(eeBomItems[0]).length) {
    //   console.log('diff', item)
    // }
    delete item['alt_currency']
    delete item['alt_origin_currency']
    delete item['alt_origin_lowest_price']
    delete item['alt_valid_from']
    delete item['alt_vendor_pn']

    delete item['alt_grouping_list']

    delete item['alt_currency_without_main_pn']
    delete item['alt_origin_currency_without_main_pn']
    delete item['alt_origin_lowest_price_without_main_pn']
    delete item['alt_valid_from_without_main_pn']
    delete item['alt_vendor_pn_without_main_pn']

    delete item['spa_partnumber']
    delete item['spa_manufacturer']
    delete item['original_currency']
    delete item['original_spa_price']
    delete item['exp_spa_partnumber']
    delete item['exp_spa_manufacturer']
    delete item['spa_expire_date']
    delete item['spa_valid_from']
    delete item['plant']
    delete item['purchaseorg']
    delete item['plantcode']
    delete item['eedm_avap']

    delete item['customer']
    delete item['product_type']
    delete item['alt_similar_info']
    delete item['alt_similar_info_without_main_pn']
    delete item['spa_similar_info']

    delete item['last_price_manufacturer']
    delete item['last_price_vendor_part_no']
    delete item['last_price_vendor']
    return item
  })
}

const upsertEEBomDetail = async(eeBomItems) =>{
  // console.log(eeBomItems)
  let onConflictClause = getEEBOMDetailOnConflictSql()
  let chunkUpsertArray = chunkArray(eeBomItems, 10)
  await asyncForEach(chunkUpsertArray, async (subArr, idx) => {
    let sql = squel.insert()
      .into('wiprocurement.eebom_detail')
      .setFieldsRows(subArr)
      .toParam()
    sql.text += onConflictClause
    // await client.query(sql)

    // console.log(sql)
    let result = await systemDB.Query(sql)
    logger.debug(`upsert: batch ${idx} count ${result.rowCount} data into table eebom_detail`)
  })
}

module.exports = {
  aggre_BOM_DETAIL_TABLE: dbHelper.atomic(async (client, version_id) => {
    logger.info(`----start aggre_BOM_DETAIL_TABLE----${new Date()}`)
    if (version_id && version_id.length == 0) {
      logger.debug('no update version, quit update eebom detail table')
      return
    }
    try {
      let eeBomItems = await getBomItems(version_id)
      const isGroupPcbBoard = true
      let eeBomItemListIncludePcbBoard = await getBomItems(version_id, isGroupPcbBoard)
      let allPartNum = eeBomItems.map(e => e.part_number)
      logger.debug(`get ${allPartNum.length} different partnum com from table 'eedm_bom_item'&'edm_version'`)
      if (allPartNum.length == 0) {
        logger.warn('no part number need to process')
        return
      }
      let spaPair = await getSPAPrice(allPartNum)
      logger.debug(`get ${spaPair.length} pairs by partnum from table 'eedm_spa_price'`)

      let maraValPair = await getPartNumberDescription(allPartNum)
      logger.debug(`get ${maraValPair.length} pairs by partnum from table 'mara'`)

      let cbgValPair = await getPartNumberTypes(allPartNum)
      logger.debug(`get ${cbgValPair.length} pairs by partnum from table 'epur_itemtype'`)

      let marcValPair = await getPartNumberPlantAndSupplyType(allPartNum)
      logger.debug(`get ${marcValPair.length} pairs by partnum from table 'marc'`)

      let pricePair = await getPartNumberHighestPrice(allPartNum)
      logger.debug(`get ${pricePair.length} pairs by partnum from table 'eedm_pn_price'`)

      let lowestPricePair = await getPartNumberLowestPrice(allPartNum)
      logger.debug(`get ${lowestPricePair.length} pairs by partnum from table 'eedm_pn_lowest_price'`)

      let secondHighestPricePair = await getPartNumber2ndHighestPrice(allPartNum)
      logger.debug(`get ${secondHighestPricePair.length} pairs by partnum from table 'eedm_pn_2nd_highest_price'`)

      let pdmpartsPair = await getPartNumberLifeCycle(allPartNum)
      logger.debug(`get ${pdmpartsPair.length} pairs by partnum from table 'pdmparts'`)

      let commonPartsPair = await getCommonPart(allPartNum)
      logger.debug(`get ${commonPartsPair.length} pairs by partnum from table 'view_common_parts'`)

      let altPricePair = await getAltPrice(allPartNum)
      logger.debug(`get ${altPricePair.length} pairs by partnum from table 'spaalt_price'`)

      let avlListPair = await getAvlList()
      logger.debug(`get ${avlListPair.length} pairs by customer and bu from table 'eebom_avl'`)

      let item_info = {
        eeBomItems,
        maraValPair,
        marcValPair,
        cbgValPair,
        pdmpartsPair,
        commonPartsPair,
        avlListPair,
      }

      let price_info = {
        pricePair,
        lowestPricePair,
        secondHighestPricePair,
        spaPair,
        altPricePair,
      }

      // --- 處理 在eedm bom item 中的bom item 資料 ---
      await processEEBomItems(item_info, price_info)
      logger.debug(`merege all data ${eeBomItems.length} together`)
      let eebomItemListNoPcbBomItem = pcbCrontab.getBomItemListExceptPcbBom(eeBomItems)
      await upsertEEBomDetail(eebomItemListNoPcbBomItem)
      logger.debug(`upsertEEBomDetail OK. data length :${eebomItemListNoPcbBomItem.length}`)

      // --- 處理 在eedm bom item 中的pcb 資料 ---
      let pcbBomItemList = pcbCrontab.getPcbBomItemListByBomItemList(eeBomItems)
      let pcbExtraInfoList = pcbCrontab.formatPcbExtraInfoByEebomItemList(eeBomItemListIncludePcbBoard)
      const processPcbBomItemList = pcbCrontab.processPcbBomItemList(pcbBomItemList, pcbExtraInfoList)
      await pcbCrontab.upsertPcbBomItemListToTemp(processPcbBomItemList)
      logger.debug(`upsertPcbBomItemListToTemp OK. data length :${pcbBomItemList.length}`)

      if (version_id && version_id.length > 0) {
      // update refresh time
        await updateEEBomRefreshTime(version_id)
      }
      // 通知epro拉pcb資料
      await commonUtil.requestPostToEprocurement('/eebom/syncEedmPcbBomItem', null)
      logger.info(`----end aggre_BOM_DETAIL_TABLE----${new Date()}`)
      return eeBomItems.length
    } catch (error) {
      logger.error('[eebomCrontab][aggre_BOM_DETAIL_TABLE] Error :', error)
      throw new Error(error)
    }
  }),
  syncLpp : async (src) =>{
    let edm_versions = await getEdmVersions()
    let partNumbers = []
    let eebomDetails
    for(let edm_version of edm_versions) {
      eebomDetails = await getAllEebomDetail(edm_version.id)
      partNumbers = []
      eebomDetails.map((bomDetailInfo) => {
        partNumbers.push(bomDetailInfo.part_number)
      })
      await getLpp(partNumbers, eebomDetails)
    }
    // let eebomDetails = await getAllEebomDetail()
    // let partNumbers = []
    // eebomDetails.map((bomDetailInfo) => {
    //   partNumbers.push(bomDetailInfo.part_number)
    // })
    // await getLpp(partNumbers, eebomDetails)
    return true
  },
}
