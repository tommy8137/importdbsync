const { systemDB, financeDB, eedmDB } = require('../../helpers/database')
let squel = require('squel').useFlavour('postgres')
const moment = require('moment-timezone')
const { insertLog } = require('../../utils/log/log.js')
const _ = require('lodash')
const spaService = require('../../service/spa.js')
const eedmService = require('../../service/eedm.js')
const altService = require('../../service/alt.js')
const aggreEEbom = require('./eebom')
const uuidv4 = require('uuid/v4')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('Eedm')
const eedmModel = require('../../model/eedm')
const xrayModel = require('../../model/spa.js')
const vfilter = require('../../service/venderfilter')
const cacheStore = require('../../service/storecache.js')
const altpartModel = require('../../model/altpart.js')
const { fixedPoint } = require('../../utils/common/math.js')
const commonLogical = require('../../utils/common/logical.js')
const { DecimalGetter } = require('../../utils/decimalConfig/index.js')

const eeFloatPoint = new DecimalGetter('EEBom')
const EEDM_RECEVIER_KEY = 'eedm'

const SPA_COL = [
  'partnumber',
  'spa_price',
  'spa_partnumber',
  'manufacturer',
  'update_time',
  'exp_spa_price',
  'exp_spa_partnumber',
  'exp_manufacturer',
  'expire_time',
  'original_currency',
  'original_spa_price',
  'valid_from',
  'similar_info',
]

const CURRENT_PRICE_COL = [
  'mpnno',
  'description',
  'vendor_code',
  'manufacturer',
  'vendor_pn',
  'price',
  'currency_price',
  'currency',
  'exchange_rate',
  'update_time',
  'update_by',
  'valid_from',
]

const ALT_COL = [
  'item_num',
  'alt_num',
  'lowest_price',
  'origin_lowest_price',
  'currency',
  'origin_currency',
  'valid_from',
  'manufacturer',
  'grouping',
  'update_time',
  'update_by',
  'similar_info',
  'vendor_pn',
  'alt_num_without_main_pn',
  'lowest_price_without_main_pn',
  'origin_lowest_price_without_main_pn',
  'currency_without_main_pn',
  'origin_currency_without_main_pn',
  'valid_from_without_main_pn',
  'manufacturer_without_main_pn',
  'similar_info_without_main_pn',
  'vendor_pn_without_main_pn',
]

/**
 * 取出資料裡的spect01~spec30
 * @param {object} data 輸入包含 'partnumber','type1','type2','spect01~spec30'
 * @returns {object} object只有'spect01~spec30' key
 */
const onlyGetRule = (data) => {
  let specRules = _.omit(data, 'partnumber', 'type1', 'type2')
  let spec = Object.keys(specRules).filter(k => {
    if (data[k] == 'Y') return k
  })
  return spec
}
/**
 * 包裝sendMail
 * @param {Object} info
 */
async function sendMail(info){
  await mail.sendmail(msg.failedMsg(info, EEDM_RECEVIER_KEY))
}


/**
 * 將 P/N 和 purchaseorg 為key 組成一個group
 *
 * ex: {
 * '009.1071D.0061_PWCD':
   [ { partnumber: '009.1071D.0061',
       description: 'CAP EL 100U 16V M RT2.5 6.3*5 SOLID CAP',
       purchaseorg: 'PWCD',
       mpnno: 'MPN02178223',
       vendor_code: '0000601464',
       manufacturer: 'ELITE',
       vendor_pn: 'UPE1C101MP26305',
       price: 0.03636,
       currency: 'USD',
       valid_from: 2019-09-30T16:00:00.000Z,
       valid_to: 2099-12-30T16:00:00.000Z,
       knumh: '0190642186' } ]
 * }
 */
const getPriceGroup = (pnPriceList) => {
  _.mixin({
    groupByComposite: (collection, keys, delimiter = '_') =>
      _.groupBy(collection, (item) => {
        const compositeKey = [];
        _.each(keys, key => compositeKey.push(item[key]));
        return compositeKey.join(delimiter);
      }),
  });

  // sprint 29, 不將'purchaseorg' 列入計算, 故不使用 purchaseorg作為分類條件
  return _.groupByComposite(pnPriceList, ['partnumber'])
}
/**
 * 整理成 insert到DB的資料
 */
const currentPriceObj = (partnumber, mathPrice = null) => {
  return {
    partnumber: partnumber,
    purchaseorg: mathPrice ? mathPrice.purchaseorg : null,
    mpnno: mathPrice ? mathPrice.mpnno : null,
    description: mathPrice ? mathPrice.description : null,
    vendor_code: mathPrice ? mathPrice.vendor_code : null,
    manufacturer: mathPrice ? mathPrice.manufacturer : null,
    vendor_pn: mathPrice ? mathPrice.vendor_pn : null,
    price:  mathPrice ? mathPrice.price : null,
    currency_price:  mathPrice ? mathPrice.currency_price : null,
    currency:  mathPrice ? mathPrice.currency : null,
    valid_from:  mathPrice ? moment(mathPrice.valid_from).tz('Asia/Taipei').format('YYYY-MM-DD') : null,
    exchange_rate:  mathPrice ? mathPrice.exchange_rate : null,
    create_time: 'NOW()',
    create_by: 'EEDM db sync',
    update_time: 'NOW()',
    update_by: 'EEDM db sync',
  }
}
/**
 * 轉換匯率，並記錄原始的價格跟幣別
 */
const priceExchangeRate = (itemCurrentPrice, mrate) => {

  return _.map(itemCurrentPrice, (item) => {
    let itemExchange = {}
    let rate = _(mrate).find({ from_currency: item.currency })

    itemExchange.currency_price = item.price // origin price
    itemExchange.price = item.currency == 'USD' ? item.price : fixedPoint(item.price * rate.exchange_rate, eeFloatPoint.get('default'))
    itemExchange.exchange_rate = item.currency == 'USD' ? 1 : fixedPoint(rate.exchange_rate, eeFloatPoint.get('default'))

    return {
      ...item,
      ...itemExchange,
    }
  })
}
/**
 * pn request中的partnumber, 將根據 type 取價格最高價/最低價
 */
const getCurrentPriceList = (pnList, currentPrice, mrate, type = 'mix') => {
  // 只取 USD 價格來比較的type
  let types = ['MLCC']
  let currentPriceList = []
  let keys = Object.keys(currentPrice)

  keys.map((key) => {
    let pnInfo = _.find(pnList, (pn) => pn.partnumber == key)
    let price = currentPrice[key]

    // 轉換匯率 -> USD, 才能拿價錢來比較
    let priceExchangeRateRes = priceExchangeRate(price, mrate)

    // sprint 30: MLCC 只取 USD 價格來比較
    if(types.includes(commonLogical.determineType(pnInfo.partnumber, pnInfo.type1name, pnInfo.type2name))) {
      priceExchangeRateRes = _.filter(priceExchangeRateRes, (res) => res.currency == 'USD')
    }

    if (priceExchangeRateRes.length > 0) {
      let mathPrice = type == 'mix' ? _(priceExchangeRateRes).maxBy('price') : _(priceExchangeRateRes).minBy('price')
      currentPriceList.push(currentPriceObj(key, mathPrice))
    }


  })

  return currentPriceList
}

/**
 * 根據 orderType 取價格的第二筆資料(第二高價/第二低價)
 */
const get2ndPrice = (priceList, orderType = 'asc') => {
  let listByPrice = _.chain(priceList)
    .orderBy(['price'], [orderType])
    .groupBy('price')
    .value()

  let priceKeys = Object.keys(listByPrice)
  let secondPrice = null
  if (priceKeys.length >= 2) {
    secondPrice = listByPrice[priceKeys[1]]
  } else {
    secondPrice = listByPrice[priceKeys[0]]
  }

  return secondPrice[0]
}
/**
 * 根據 type 取價格第二高價/第二低價
 */
const get2ndCurrentPriceList = (pnList, currentPrice, mrate, type = 'mix') => {
  let types = ['MLCC']
  let currentPriceList = []
  let keys = Object.keys(currentPrice)

  keys.map((key) => {
    let pnInfo = _.find(pnList, (pn) => pn.partnumber == key)
    let price = currentPrice[key]

    // 轉換匯率 -> USD, 才能拿價錢來比較
    let priceExchangeRateRes = priceExchangeRate(price, mrate)

    // sprint 30: MLCC 只取 USD 價格來比較
    if(types.includes(commonLogical.determineType(pnInfo.partnumber, pnInfo.type1name, pnInfo.type2name))) {
      priceExchangeRateRes = _.filter(priceExchangeRateRes, (res) => res.currency == 'USD')
    }

    if (priceExchangeRateRes.length > 0) {
      let mathPrice = type == 'mix' ? get2ndPrice(priceExchangeRateRes, 'desc') : get2ndPrice(priceExchangeRateRes, 'asc')
      currentPriceList.push(currentPriceObj(key, mathPrice))
    }
  })

  return currentPriceList
}

/**
 * 取得篩選的價格表
 * @param {*} pnList 料號列表
 * @param {*} currentPrice 價格表
 * @param {Array} types 取得此類別的資料
 */
const filterTypeList = (pnList, currentPrice, types) => {

  // 取 篩選的 partnumber
  let list = pnList.filter((pn) => types.includes(commonLogical.determineType(pn.partnumber, pn.type1name, pn.type2name)))
  let pnFilterByTypeList = _.map(list, 'partnumber')

  // 取 篩選的 partnumber的價格List
  let currentPriceByType = []
  Object.keys(currentPrice).map((pnKey) => {
    if (pnFilterByTypeList.includes(pnKey.split('_')[0])){
      currentPriceByType[pnKey] = currentPrice[pnKey]
    }
  })

  return currentPriceByType
}
/**
 * 預處理 wiprocurement.eedm_pn_request 的料號最高價，insert to wiprocurement.eedm_pn_price
 */
const handleHighestPrice = async (startTime, pnList, currentPrice, mrate) => {
  logger.debug('handleHighestPrice:', 'get the highest price in each group')

  let types = ['MLCC', 'RES']
  let currentPriceByType = filterTypeList(pnList, currentPrice, types)

  // 每一個pn& purchase org 價格
  let currentPriceList = getCurrentPriceList(pnList, currentPriceByType, mrate, 'mix')

  if (currentPriceList.length > 0) {
    // console.log(insertUpdateBulk('wiprocurement.eedm_pn_price', currentPriceList, CURRENT_PRICE_COL))
    await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_pn_price', currentPriceList, CURRENT_PRICE_COL))
    // await systemDB.Query(squel.delete().from('wiprocurement.eedm_pn_price').where('update_time < DATE \'TODAY\'',).toParam())
    await systemDB.Query(getDeleteSql('wiprocurement.eedm_pn_price'))

  }

  let count = currentPriceList.length
  logger.info(`insert or update ${count} in table eedm_pn_price`)
  let dura_sec = (new Date() - startTime) / 1000
  await insertLog('syncData', 'EEDM_PN_HIGHEST_PRICE', count, new Date(), dura_sec, 'complete', null)
  return currentPriceList.length
}

/**
 * 預處理 wiprocurement.eedm_pn_request 的MLCC料號第二高價，insert to wiprocurement.eedm_pn_2nd_highest_price
 */
const handle2ndHighestPrice = async (startTime, pnList, currentPrice, mrate) => {
  let types = ['MLCC']
  logger.debug('handle2ndHighestPrice:', `get ${types} 2nd highest price in each group`)

  let currentPriceByType = filterTypeList(pnList, currentPrice, types)
  let currentPriceList = get2ndCurrentPriceList(pnList, currentPriceByType, mrate)

  if (currentPriceList.length > 0) {
    // console.log(insertUpdateBulk('wiprocurement.eedm_pn_2nd_highest_price', currentPriceList, CURRENT_PRICE_COL))
    await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_pn_2nd_highest_price', currentPriceList, CURRENT_PRICE_COL))
    // await systemDB.Query(squel.delete().from('wiprocurement.eedm_pn_2nd_highest_price').where('update_time < DATE \'TODAY\'',).toParam())
    await systemDB.Query(getDeleteSql('wiprocurement.eedm_pn_2nd_highest_price'))
  }
  let count = currentPriceList.length
  logger.info(`insert or update ${count} in table eedm_pn_2nd_highest_price`)
  let dura_sec = (new Date() - startTime) / 1000
  await insertLog('syncData', 'EEDM_PN_2ND_HIGHEST_PRICE', count, new Date(), dura_sec, 'complete', null)
  return currentPriceList.length
}

/**
 * 預處理 wiprocurement.eedm_pn_request 的料號最低價，insert to wiprocurement.eedm_pn_lowest_price
 */
const handleLowestPrice = async (startTime, pnList, currentPrice, mrate) => {
  logger.debug('handleLowestPrice:', 'get the lowest price in each group')

  let types = ['MLCC', 'OTHERS']
  let currentPriceByType = filterTypeList(pnList, currentPrice, types)
  let currentPriceList = getCurrentPriceList(pnList, currentPriceByType, mrate, 'min')

  if (currentPriceList.length > 0) {
    // console.log(insertUpdateBulk('wiprocurement.eedm_pn_lowest_price', currentPriceList, CURRENT_PRICE_COL))
    await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_pn_lowest_price', currentPriceList, CURRENT_PRICE_COL))
    // await systemDB.Query(squel.delete().from('wiprocurement.eedm_pn_lowest_price').where('update_time < DATE \'TODAY\'',).toParam())
    await systemDB.Query(getDeleteSql('wiprocurement.eedm_pn_lowest_price'))
  }
  let count = currentPriceList.length
  logger.info(`insert or update ${count} in table eedm_pn_lowest_price`)
  let dura_sec = (new Date() - startTime) / 1000
  await insertLog('syncData', 'EEDM_PN_LOWEST_PRICE', count, new Date(), dura_sec, 'complete', null)
  return currentPriceList.length
}

const getDeleteSql = (table) => {
  let time = moment().format('HH:mm:ss')
  let date = moment().format('YYYY-MM-DD')

  let deleteSQL = squel.delete().from(table)
  if (time >= '12:00:00') {
    return (deleteSQL.where('update_time < ?', `${date} 12:00:00`).toParam())
  } else {
    return (deleteSQL.where('update_time < DATE \'TODAY\'',).toParam())
  }
}

const isNumber = function (num) {
  if (num == null || num.toString().replace(/\s/g, '') == '') {
    return false
  }
  // check Number
  num = Number(num)
  if(isNaN(num)){
    return false
  } else {
    return true
  }
}
class Eedm {
  static async syncSAP_ALT_PN() {
    let start = new Date()
    logger.debug(`---- start syncSAP_ALT_PN ----${new Date()}`)
    let info = { typeName: 'syncSAP_ALT_PN', updateBy: 'syncSAP_ALT_PN' }

    try {
      // 0. cache機制 替代料號 可以不需要重複地去找最低價
      let storeCache = await new cacheStore()

      // 2. 取得pn from eedm_pn_request
      let pnRuquest = await eedmModel.getPnRequest()
      let count = 0

      if (pnRuquest.length > 0) {
        logger.debug('start to get alt partnumber, and pn request length', pnRuquest.length)
        for (let i = 0; i < pnRuquest.length; i++) {
          if (pnRuquest[i].type1name) {
            // 3. 從 alt_group中 找到所有的相似料
            // let altItemGroup = await altpartModel.getAltItemGroup(pnRuquest.partnumber)
            let altParts = await altpartModel.getAltItemsByGroup(pnRuquest[i].partnumber, pnRuquest[i].type1name)
            logger.debug('get alt partnumber length', pnRuquest[i].partnumber, pnRuquest[i].type1name, altParts.length)

            if (altParts.length > 0) {
              // 4. 計算last price 找到最低價的料
              logger.debug('getAltLowestPrice: get alt lowest price', pnRuquest[i].partnumber, altParts)
              let altRes = await altService.getAltLowestPrice(pnRuquest[i], storeCache, altParts)

              altRes['update_time'] = moment().utc().format()
              altRes['update_by'] = 'db_sync'

              // 5. insert 將結果塞到db table: sapalt_price
              // console.log(insertUpdateBulk('wiprocurement.sapalt_price', [altRes], ALT_COL))
              await systemDB.Query(insertUpdateBulk('wiprocurement.sapalt_price', [altRes], ALT_COL))
              logger.debug('done: get alt lowest price', pnRuquest[i].partnumber)
              count++
            }
          }
        }
        // 6. 刪除舊有的資料
        await systemDB.Query(squel.delete().from('wiprocurement.sapalt_price').where('update_time < DATE \'TODAY\'',).toParam())
      }
      logger.debug(`find ${count} altpart`)
    } catch (error) {
      logger.error('sync syncSAP_ALT_PN failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`---- end syncSAP_ALT_PN ----${new Date()}`)
  }

  static async syncEEBomBase(condition) {

    let info = { typeName: 'syncEEBomBase', updateBy: 'syncEEBomBase' }
    let updateVerIds = []
    try {
      let start = new Date()
      logger.debug(`---- start sync ee bombase ----${new Date()}`)
      let { selectSQL, updateSQL } = prepare_syncEEBomBase_SQL(condition)
      // get cost_summarytable
      logger.debug(`sql for sync ee bom base ${selectSQL.toString()}`)
      const { rows } = await systemDB.Query(selectSQL.toParam())
      logger.debug(`There's ${rows.length} project to be sync`)

      // get project & version from cost_summarytable
      let { project: mergedProjects, version: mergeVersions } = await eedmService.fetchEEBOM(rows)

      // start to upsert
      if (mergedProjects.length > 0) {
        await this.writeEEBomProject(mergedProjects)
      }
      if (mergeVersions.length > 0) {
        await this.writeEEBomVersion(mergeVersions)
        updateVerIds = _.chain(mergeVersions).uniq('id').map(item => item.id).value()
        logger.debug('triiger aggre_BOM_DETAIL_TABLE function for eebom detail', updateVerIds.length)
      }
      // update eedm_cost_summarytable set processed as done
      logger.debug(`sql for update ee bom base sql: ${updateSQL.toString()}`)
      await systemDB.Query(updateSQL.toParam())
      // TODO: use transaction
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EEBomBase', mergedProjects.length, new Date(), dura_sec, 'complete', `Project:${mergedProjects.length}, Version:${mergeVersions.length}`)
    } catch (error) {
      logger.error('sync syncEEBomBase failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`---- end sync EEBomBase ----${new Date()}`)
    return updateVerIds
  }

  static async writeEEBomProject(data) {
    // console.log('writeEEBomProject', insertUpdateKeyBulk('wiprocurement.eebom_projects', data, ['customer', 'product_type', 'project_name', 'sku', 'version_remark', 'project_leader', 'plant', 'purchasing_organization', 'update_time', 'platform', 'panel_size', 'pcbno', 'plant_code', 'origin_plant_code'], ['project_code', 'sku', 'stage', 'pcbno', 'platform']))

    await systemDB.Query(insertUpdateKeyBulk('wiprocurement.eebom_projects', data, ['customer', 'product_type', 'project_name', 'sku', 'version_remark', 'project_leader', 'plant', 'purchasing_organization', 'update_time', 'platform', 'panel_size', 'pcbno', 'plant_code', 'origin_plant_code'], ['project_code', 'sku', 'stage', 'pcbno', 'platform']))
    logger.debug('Write eebom_projects:', data.length)
  }

  static async rebuildEEBOMProject() {
    // 這段code是為了將eebom_projects的三個key(project+sku+stage)變成五個key(project+sku+stage+pcbno+platform)所寫的 (需特別處理原本的version串接到新project上以避免data lost)
    const { rows } = await systemDB.Query('SELECT * FROM wiprocurement.eedm_cost_summarytable;')
    // const { rows: originProjects } = await systemDB.Query('SELECT * FROM wiprocurement.eebom_projects;')
    logger.debug(`There's ${rows.length} project to be sync`)
    let projectList = []
    let versionList = []
    for (let i = 0; i < rows.length; i++) {
      let versionKey = `${rows[i].pcbno}_${rows[i].stage}_${rows[i].sku}_${rows[i].uploadtime}`
      if (rows[i].projectcode && rows[i].projectcode.length > 0) {
        let { rows: originProject } = await systemDB.Query('SELECT id FROM wiprocurement.eebom_projects WHERE project_code=$1 AND stage=$2 AND sku= $3;', [rows[i].projectcode, rows[i].stage, rows[i].sku])
        let eebomID = originProject.length > 0 ? originProject[0].id : uuidv4()
        // let eebomID = `${rows[i].projectcode}_${rows[i].sku}_${rows[i].stage}`
        projectList.push({
          'id': uuidv4(),
          'stage': rows[i].stage,
          'project_code': rows[i].projectcode,
          'sku': rows[i].sku,
          'version_remark': 'EEDM_RENEW', // FIXME: tmp code for mark EEDM data
          'upload_time': rows[i].uploadtime,
          'originID': eebomID,
          'eedm_version': versionKey,
          'platform': rows[i].platform,
          'panel_size': rows[i].panel_size,
          'pcbno': rows[i].pcbno,
        })
        // versionList.push(new Version({
        //   'id': uuidv4(),
        //   'version': versionKey,
        //   'eebom_project_id': eebomID,
        //   'upload_time': rows[i].uploadtime,
        // }))
      } else {
        logger.warn(`${versionKey} has no project`)
      }
    }
    logger.debug('check project length', projectList.length)
    // by project + sku + stage + pcbno + platform 分群, 再從中找出最大upload_time的資料
    let distinctMaxProjects = _.chain(projectList).groupBy(item => `${item.project_code}_${item.sku}_${item.stage}_${item.pcbno}_${item.platform}`).mapValues(a => (_.maxBy(a, 'upload_time'))).flatMapDeep().value()
    // mapping PLM data
    let pcodes = _.chain(distinctMaxProjects).uniq('project_code').map(item => item.project_code).value()
    let { rows: plmList } = await systemDB.Query(getProjects(pcodes))
    let { rows: rfqList } = await systemDB.Query(getRFQProjects(pcodes))
    const { rows: plantList } = await systemDB.Query('SELECT plant,purchase_org FROM wiprocurement.plant_list;')
    let s3SQLs = []
    let s4SQLs = []
    let originProjectList = _.map(distinctMaxProjects, 'originID')
    let getProject = squel.select().field('id').field('version')
      .from('wiprocurement.eebom_projects').where('id in ?', _.uniq(originProjectList))
    let originVersion = await systemDB.Query(getProject.toString())
    let versionUpdate = await systemDB.Query('select MAX(upload_time), eebom_project_id from wiprocurement.edm_version group by eebom_project_id')
    let updateSQLForVersion = []
    _.map(versionUpdate.rows, (project) => {
      let version = _.find(originVersion.rows, (v) => v.id == project.eebom_project_id)
      if(version) {
        if(parseInt(version.version) == 0) {
          version.version = '0.0'
        }
        updateSQLForVersion.push(`update wiprocurement.edm_version SET status_version=${version.version} where eebom_project_id='${project.eebom_project_id}' and upload_time ='${project.max}';`)
      }
    })
    let mergedProjects = _.map(distinctMaxProjects, item => {
      console.log(`${item.originID} => ${item.id} => ${item.eedm_version}`)
      let plmBase = plmList.find(base => item.project_code == base.projectname)
      let rfqBase = rfqList.find(base => item.project_code == base.project_code)
      // let origin = originProjects.find(o => item.project_code == o.project_code && item.sku == o.sku && item.stage == o.stage)
      // // 檢查id: 如果查到eebom_projects = projectcode_sku (代表還沒變過), 就用新給的id, 否則就用原本的id(第二次之後執行)
      // if (typeof (origin) != 'undefined')
      //   item.id = origin.id == `${item.projectcode}_${item.sku}` ? item.id : origin.id
      if (plmBase) {
        // plant handling // by Ray 提供的邏輯: 若多廠又包含601(新竹廠), 移除該選項後, 取排序最後的一個(數字最大)
        let plmPlant = plmBase.plantcode.split(',').sort().reverse()
        if (plmPlant.length > 1 && plmPlant.includes('601')) plmPlant.splice(plmPlant.indexOf('601'), 1)
        let plantCode = `F${plmPlant[0]}`
        let plantData = plantList.find(base => plantCode == base.plant)

        item.customer = plmBase.cusnickname
        item.project_leader = plmBase.projectleader
        item.project_name = plmBase.acrprjname
        item.product_type = plmBase.producttype
        item.plant = plantCode
        item.purchasing_organization = plantData.purchase_org
        item.caculation_date = 'NOW()'
      } else if (rfqBase) {
        //console.log(rfqBase)
        // plant handling // by Ray 提供的邏輯: 若多廠又包含601(新竹廠), 移除該選項後, 取排序最後的一個(數字最大)
        let plmPlant = rfqBase.plantcode.split(',').sort().reverse()
        if (plmPlant.length > 1 && plmPlant.includes('601')) plmPlant.splice(plmPlant.indexOf('601'), 1)
        let plantCode = `F${plmPlant[0]}`
        let plantData = plantList.find(base => plantCode == base.plant)

        item.customer = rfqBase.cusnickname
        item.project_leader = rfqBase.project_leader
        item.project_name = rfqBase.acrproject_name
        //item.product_type = rfqBase.producttype //RFQ project don't have product type
        item.plant = plantCode
        item.purchasing_organization = plantData.purchase_org
        item.caculation_date = 'NOW()'
      }
      // let updateVersionSQL = `update wiprocurement.edm_version SET eebom_project_id='${item.id}' where eebom_project_id='${item.originID}' and upload_time ='${item.upload_time}';`
      // let tempSQL = `select id,version,eebom_project_id from wiprocurement.edm_version where version='${item.eedm_version}';`
      // s3SQLs.push(updateVersionSQL)
      // let rollbackVersionSQL = `update wiprocurement.edm_version SET eebom_project_id='${item.originID}' where version='${item.eedm_version}';`
      let deleteProjectSQL = `delete from wiprocurement.eebom_projects where id='${item.originID}' and not exists (select 1 from wiprocurement.edm_version v where v.eebom_project_id = wiprocurement.eebom_projects.id);`
      s4SQLs.push(deleteProjectSQL)
      // updateVersion.push(updateVersionSQL)
      return new Project(item)
    })
    console.log('sync', mergedProjects.length, 'projects')

    let mergedMaxProjects = _.chain(projectList).groupBy(item => `${item.project_code}_${item.sku}_${item.stage}_${item.pcbno}_${item.platform}_${item.upload_time}`).flatMapDeep().value()
    mergedProjects = _.sortBy(mergedProjects, ['project_code', 'stage', 'sku', 'pcbno', 'pcbno', 'platform', 'upload_time'])
    _.map(mergedMaxProjects, item => {
      _.map(mergedProjects, projectitem => {
        if(item.project_code == projectitem.project_code && item.stage == projectitem.stage && item.sku == projectitem.sku && item.pcbno == projectitem.pcbno && item.platform == projectitem.platform) {
          let updateVersionSQL = `update wiprocurement.edm_version SET eebom_project_id='${projectitem.id}' where eebom_project_id='${item.originID}' and upload_time ='${item.upload_time}';`
          s3SQLs.push(updateVersionSQL)
        }
      })
    })

    let client = await systemDB.pool.connect()
    try {
      await client.query('BEGIN')
      // mapping 舊的 project version 至 edm_version 的status_version
      logger.info('1. Update edm_version version by latest upload_time')
      await asyncForEach(updateSQLForVersion, async item => {
        logger.debug(item)
        await client.query(item)
      })
      // 將剩餘的version update為0.0
      await client.query('update wiprocurement.edm_version SET status_version=\'0.0\' where status_version is null;')
      // 切割原始版本 只留下 upload_time
      await client.query('update wiprocurement.edm_version SET "version" = split_part("version", \'_\', 4);')

      // 1. 移除原eebom_projects內Unique key
      logger.info('1. Drop CONSTRAINT: project_unique_key')
      let droUKSQL = 'ALTER TABLE wiprocurement.eebom_projects DROP CONSTRAINT project_unique_key;'
      logger.debug(droUKSQL)
      await client.query(droUKSQL)
      // 1.1. 加回原本eebom_projects的Unique key, 並改為Project + SKU + Stage + pcbno + platform
      logger.info('5. Add CONSTRAINT: project_unique_key')
      let addUKSQL = 'ALTER TABLE wiprocurement.eebom_projects ADD CONSTRAINT project_unique_key UNIQUE (project_code,sku,stage,pcbno,platform);'
      logger.debug(addUKSQL)
      await client.query(addUKSQL)

      // 2. 將eebom_projects資料重新另外寫入一批, 並且assign新的ProjectID為 uuid (原為ProjectCode + SKU + stage)
      logger.info('2. Insert eebom_projects', mergedProjects.length)
      logger.debug(insertUpdateKeyBulk('wiprocurement.eebom_projects', mergedProjects, ['customer', 'product_type', 'project_name', 'stage', 'version', 'sku', 'version_remark', 'project_leader', 'plant', 'purchasing_organization', 'update_time', 'pcbno', 'platform', 'panel_size'], ['project_code', 'sku', 'stage', 'pcbno', 'platform']))
      if (mergedProjects.length > 0) await client.query(insertUpdateKeyBulk('wiprocurement.eebom_projects', mergedProjects, ['customer', 'product_type', 'project_name', 'stage', 'version', 'sku', 'version_remark', 'project_leader', 'plant', 'purchasing_organization', 'update_time', 'pcbno', 'platform', 'panel_size'], ['project_code', 'sku', 'stage', 'pcbno', 'platform']))
      // 3. 修改edm_version的foreign project id為新的這批, 解除舊有資料的綁定
      logger.info('3. Update edm_version', s3SQLs.length)
      await asyncForEach(s3SQLs, async item => {
        logger.debug(item)
        await client.query(item)
      })
      // 4. 刪除除eebom_projects的舊資料
      logger.info('4. Delete eebom_projects', s4SQLs.length)
      await asyncForEach(s4SQLs, async item => {
        logger.debug(item)
        await client.query(item)
      })
      await client.query('COMMIT')
      await client.release()
    } catch (error) {
      logger.warn('--- ROLLBACK ---', error)
      await client.query('ROLLBACK')
      await client.release()
      throw error
    }
  }

  static async writeEEBomVersion(data) {
    data = _.uniqBy(data, 'id')
    // console.log('writeEEBomVersion', insertUpdateKeyBulk('wiprocurement.edm_version', data, ['version', 'upload_time'], ['id']))
    await systemDB.Query(insertUpdateKeyBulk('wiprocurement.edm_version', data, ['version', 'upload_time'], ['id']))
    logger.debug('Write edm_version: ', data.length)
  }

  static async syncEEDM_BOM_ITEM(targetTableName) {
    if (targetTableName == 'all') {
      //logger.debug(targetTableName)
      const { rows:tables } = await systemDB.Query('select distinct pcbno||\'_\'||stage||\'_\'||sku||\'_\'||uploadtime as table_name from wiprocurement.eedm_cost_summarytable')
      for (let i = 0; i < tables.length; i++) {
        try {
          await this.syncEEDM_BOM_ITEM(tables[i].table_name)
        } catch (err) {
          logger.error(err)
        }
      }
      return
    }
    let resultTable = await eedmModel.getCostSummaryTableDetailByName(targetTableName)
    logger.debug(`get data detail from [dbo].[${targetTableName} ] with size: ${resultTable.length}`)
    let itemList = []
    for (let j = 0; j < resultTable.length; j++) {
      itemList.push({
        table_name: targetTableName,
        reference: resultTable[j]['Reference'],
        schematicname: resultTable[j]['SchematicName'],
        sheet: resultTable[j]['Sheet'],
        partnumber: resultTable[j]['PartNumber'].trim(),
        description: resultTable[j]['Description'],
        usd: resultTable[j]['USD'] == '' ? null : isNumber(resultTable[j]['USD']) ? resultTable[j]['USD'] : null,
        type: resultTable[j]['Type'],
        bymodule: resultTable[j]['ByModule'],
        pic_role: resultTable[j]['PIC_Role'],
        board: resultTable[j]['Board'],
        uf: resultTable[j]['uF'],
        avap: resultTable[j]['AVAP'],
        create_time: 'NOW()',
        // update_time: 'NOW()', // 不寫update_time時間, 給後面處理標記用
      })
    }

    // 寫入BOM表
    if (itemList.length > 0) {
      let res = await systemDB.Query('DELETE FROM wiprocurement.eedm_bom_item WHERE table_name = $1;', [targetTableName]) // 寫入之前刪除舊資料避免重複
      logger.debug(`remove table name: ${targetTableName} in table eedm_bom_item`, res)
      await systemDB.Query(insertBulk('wiprocurement.eedm_bom_item', itemList))
      logger.debug(`insert ${itemList.length} records on table name: ${targetTableName} into table eedm_bom_item`)
    }
  }

  static async syncEEDM_COST_SUMMARYTABLE(condition) {
    logger.debug(` -- start sync EEDM_COST_SUMMARYTABLE -- ${new Date()}`)
    let info = { typeName: 'syncEEDM_COST_SUMMARYTABLE', updateBy: 'syncEEDM_COST_SUMMARYTABLE' }
    try {

      const lastRecord = await eedmModel.getlastRecordFromCostSummarytable()
      logger.debug('last record in summarytable is', lastRecord.rows[0])
      let start = new Date()
      // let selectSQL = squel.select().from('dbo.Cost_SummaryTable')
      //   .field('KeyID').field('PCBNO').field('Stage').field('SKU').field('ProjectCode').field('UploadTime').field('Plant').field('PO').field('eEDMUploadTime')
      // let whereSQL = squel.expr()
      let result = null
      if (condition && Object.keys(condition).length > 0) {
        logger.debug('Specific condition mode:', condition)
        // if (condition.keyid) whereSQL.and('KeyID=?', condition.keyid)
        // if (condition.pcbno) whereSQL.and('PCBNO=?', condition.pcbno)
        // if (condition.stage) whereSQL.and('Stage=?', condition.stage)
        // if (condition.sku) whereSQL.and('SKU=?', condition.sku)
        // if (condition.projectcode) whereSQL.and('ProjectCode=?', condition.projectcode)
        // if (condition.uploadtime) whereSQL.and('UploadTime=?', condition.uploadtime)
        // if (condition.eedmuploadtime) whereSQL.and('eEDMUploadTime=?', condition.eedmuploadtime)
        result = await eedmModel.getCostSummaryTableByCond(condition)
      } else if (lastRecord.rows[0].eedmuploadtime) {
        logger.debug('last record eedmuploadtime', lastRecord.rows[0].eedmuploadtime)
        // whereSQL.and('eEDMUploadTime > ?', lastRecord.rows[0].eedmuploadtime)
        result = await eedmModel.getCostSummaryTableByEedmuploadtime(lastRecord.rows[0].eedmuploadtime)
      } else if (lastRecord.rows[0].uploadtime) {
        logger.debug('last record uploadtime', lastRecord.rows[0].uploadtime)
        // whereSQL.and('UploadTime > ?', lastRecord.rows[0].eedmuploadtime)
        result = await eedmModel.getCostSummaryTableByUploadtime(lastRecord.rows[0].uploadtime)
      } else {
        logger.error('query remote Cost_SummaryTable table condition incorrect', lastRecord)
        return
      }
      // selectSQL.where(whereSQL)
      // logger.debug('sql to query data from eedm database: ', selectSQL.toString())
      // const result = await eedmDB.Query(selectSQL.toString())
      logger.debug('get data from remote EEDM_COST_SUMMARYTABLE length ', result.length)

      // 將ProjectCode用逗號分開的部分分成兩筆資料
      let updateData = []
      for (let i = 0; i < result.length; i++) {
        result[i]['update_by'] = 'api'
        const projectCodeList = result[i]['ProjectCode'] ? result[i]['ProjectCode'].split(',') : [result[i]['ProjectCode']]
        projectCodeList.forEach(code => {
          let newData = { ...result[i] }
          newData['ProjectCode'] = code
          updateData.push(newData)
        })

        // 組Table name取資料
        const targetTableName = result[i]['PCBNO'].trim() + '_' + result[i]['Stage'] + '_' + result[i]['SKU'] + '_' + result[i]['UploadTime']
        await this.syncEEDM_BOM_ITEM(targetTableName)
      }
      let bomList = []
      for (let i = 0; i < updateData.length; i++) {
        bomList.push({
          keyid: updateData[i].KeyID ? updateData[i].KeyID : null,
          pcbno: updateData[i].PCBNO ? updateData[i].PCBNO.trim() : null,
          stage: updateData[i].Stage ? updateData[i].Stage.trim() : null,
          sku: updateData[i].SKU ? updateData[i].SKU.trim() : null,
          projectcode: updateData[i].ProjectCode ? updateData[i].ProjectCode.trim() : null,
          uploadtime: updateData[i].UploadTime ? updateData[i].UploadTime.trim() : null,
          plant: updateData[i].Plant ? updateData[i].Plant.trim() : null,
          po: updateData[i].PO ? updateData[i].PO.trim() : null,
          create_time: 'NOW()',
          eedmuploadtime: updateData[i].eEDMUploadTime ? updateData[i].eEDMUploadTime.trim() : null,
          platform: updateData[i].Platform ? updateData[i].Platform.trim() : null,
          panel_size: updateData[i].Panel_Size ? updateData[i].Panel_Size.trim() : null,
          // update_time: 'NOW()', // 不寫update_time時間, 給後面處理標記用
        })
        // await systemDB.Query('INSERT INTO wiprocurement.eedm_cost_summarytable (keyid, pcbno, stage, sku, projectcode, uploadtime, plant, po, create_time, update_time, update_by)\
        //  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now(),$9)',
        //   [updateData[i].KeyID, updateData[i].PCBNO, updateData[i].Stage, updateData[i].SKU, updateData[i].ProjectCode, updateData[i].UploadTime, updateData[i].Plant, updateData[i].PO, updateData[i].update_by])
      }
      if (bomList.length > 0) {
        await systemDB.Query(insertBulk('wiprocurement.eedm_cost_summarytable', bomList))
        logger.debug(`increase ${bomList.length} length in table eedm_cost_summarytable`)
      }

      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EEDM_COST_SUMMARYTABLE', result.length, new Date(), dura_sec, 'complete', null)
      return bomList.length

    } catch (error) {
      logger.error('sync EEDM_COST_SUMMARYTABLE failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_COST_SUMMARYTABLE----${new Date()}`)
  }

  static async syncEEDM_Common_Patrs() {
    logger.debug(`----start sync EEDM_Common_Patrs----${new Date()}`)
    let info = { typeName: 'syncEEDM_Common_Patrs', updateBy: 'syncEEDM_Common_Patrs' }
    try {
      let start = new Date()
      const result = await eedmDB.Query('SELECT PartNumber, Cate, Common_Parts, Description, RuleBy FROM CPBG_Common_Parts WHERE PartNumber IS NOT NULL;')
      if (result && result.length > 0) {
        logger.debug(`get data from table Common_Parts, szie: ${result.length}`)
        let data = result.map(item => ({
          partnumber: item.PartNumber.trim(),
          cate: item.Cate,
          common_parts: item.Common_Parts,
          description: item.Description,
          ruleby : item.RuleBy,
          GroupMap : null,
          create_by: 'EEDM',
          update_time: 'now()',
        }))
        data = _.uniqBy(data, 'partnumber')
        await systemDB.Query(squel.delete().from('wiprocurement.eedm_common_parts').where('create_by = ?', 'EEDM').toParam())
        await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_common_parts', data, ['cate','common_parts','description','ruleby','groupmap','update_time']))
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EEDM_Common_Patrs', result.length, new Date(), dura_sec, 'complete')
      return result.length
    } catch (error) {
      logger.error('sync syncEEDM_Common_Patrs failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_Common_Patrs----${new Date()}`)
  }

  static async syncEEDM_PN_LIST() {
    logger.debug(`----start sync EEDM_PN_LIST----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_LIST', updateBy: 'syncEEDM_PN_LIST' }
    try {
      let start = new Date()
      const result = await eedmDB.Query('SELECT PartNumber FROM eEDM_latest_parts_list;')
      if (result && result.length > 0) {
        logger.debug(`get data from table eEDM_latest_parts_list, szie: ${result.length}`)
        let eedm_bom_item_res = await systemDB.Query(squel.select().distinct().field('partnumber').from('wiprocurement.eedm_bom_item').toParam())
        let eedm_bom_item_partnumber = _.map(eedm_bom_item_res.rows, 'partnumber')
        let data = []

        result.forEach((item) => {
          if (eedm_bom_item_partnumber.includes(item.PartNumber.trim())) {
            data.push({
              partnumber: item.PartNumber.trim(),
              create_by: 'EEDM',
            })
          }
        })

        data = _.uniqBy(data, 'partnumber')
        await systemDB.Query(squel.delete().from('wiprocurement.eedm_pn_request').where('create_by = ?', 'EEDM').toParam())
        await systemDB.Query(insertBulk('wiprocurement.eedm_pn_request', data))
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EEDM_PN_LIST', result.length, new Date(), dura_sec, 'complete')
      return result.length
    } catch (error) {
      logger.error('sync syncEEDM_PN_LIST failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_LIST----${new Date()}`)
  }

  static async syncEEDM_PN_PRICE_bySQLFunction() {
    logger.debug(`----start sync EEDM_PN_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_PRICE', updateBy: 'syncEEDM_PN_PRICE' }
    try {
      let start = new Date()
      // 如果全部的Parts一起會太慢的話, 改採 SELECT * FROM wiprocurement.fn_eproc_get_pn_price_text('006.42229.M001,009.47711.0071,020.F000I.0008,78.10523.L2L');
      // 或是 SELECT * FROM wiprocurement.fn_eproc_get_pn_price_ary(ARRAY['006.42229.M001','009.47711.0071','020.F000I.0008','78.10523.L2L']);
      // 批次傳入部份Parts分次做 (ex. 一次500個Parts)
      let result = await systemDB.Query(`SELECT * FROM wiprocurement.fn_eproc_get_pn_price()`)
      let count = result.rows[0].fn_eproc_get_pn_price
      logger.debug(`insert or update ${count} in table eedm_pn_price`)
      let dura_sec = (new Date() - start) / 1000
      logger.debug('fn_eproc_get_pn_price', count)
      await insertLog('syncData', 'EEDM_PN_PRICE', count, new Date(), dura_sec, 'complete', null)
    } catch (error) {
      logger.error('sync syncEEDM_PN_PRICE failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_PRICE----${new Date()}`)
  }

  static async getCurrentPrice(partnumber) {
    let sql = squel.select()
      .field('eina.BMATN', 'partnumber')
      .field('mara.maktx', 'description')
      .field('a018_konp.ekorg', 'purchaseorg')
      .field('a018_konp.matnr', 'mpnno')
      .field('eina.lifnr', 'vendor_code')
      .field('eina.mfrnr', 'manufacturer')
      .field('eina.mfrpn', 'vendor_pn')
      .field('cast(a018_konp.KBETR::NUMERIC/a018_konp.KPEIN*a018_konp.KUMZA/a018_konp.KUMNE as Float)', 'price')
      .field('a018_konp.konwa', 'currency')
      .field('a018_konp.datab', 'valid_from')
      .field('a018_konp.datbi', 'valid_to')
      .field('a018_konp.knumh', 'knumh')
      .from('wiprocurement.eina', 'eina')
      .left_join('wiprocurement.mara', 'mara', 'eina.bmatn = mara.matnr')
      .left_join('wiprocurement.a018_konp', 'a018_konp', 'eina.MATNR = a018_konp.MATNR and eina.lifnr=a018_konp.lifnr')
      .where('eina.BMATN in ?', partnumber)
      //.where('eina.BMATN = ?', `64.24935.6DL`)
      .where('a018_konp.datbi = ?', `2099-12-31`)
      //.where('a018_konp.datab <= Current_date')
      .order('purchaseorg')
      .order('price', false)
    // console.log(sql.toString());
    let result = await systemDB.Query(sql.toParam())
    return result.rowCount > 0 ? result.rows : []
  }

  static async syncEEDM_PN_PRICE() {
    logger.debug(`----start sync EEDM_PN_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_PRICE', updateBy: 'syncEEDM_PN_PRICE' }

    try {
      let start = new Date()
      // 1. get eedm_pn_request
      logger.debug('1. get partnumber & type1name from eedm_pn_request, epur_tpye1')
      let pn = await eedmModel.getPnRequest()

      if (pn.length == 0) {
        logger.warn('wiprocurement.eedm_pn_request is empty')
        return
      }
      // logger.debug(pn)
      logger.debug('2. get exchange rate from exchange_rate')
      let mrate = await eedmModel.getLatestExchangeRate()
      // logger.debug(mrate)

      // get current price
      logger.debug('3. get current price list by partnumber')
      let pnPriceList = await this.getCurrentPrice(pn.map(e => e.partnumber))

      logger.debug('3.1. filter vendor code')
      let vendorCodeList = await eedmModel.getVendorCode()
      let pnPriceListSortOut = _.filter(pnPriceList, (pn) => vendorCodeList.includes(pn.vendor_code))

      logger.debug('4. group current price by partnumber & purchaseorg')
      let currentPrice = getPriceGroup(pnPriceListSortOut)
      // logger.debug(currentPrice)

      logger.debug('5. get price in each group')
      await handleHighestPrice(start, pn, currentPrice, mrate)
      await handle2ndHighestPrice(start, pn, currentPrice, mrate)
      let currentLen = await handleLowestPrice(start, pn, currentPrice, mrate)

      return currentLen
    } catch (error) {
      logger.error('sync syncEEDM_PN_PRICE failed', error)
      // info.msg = error
      // await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_PRICE----${new Date()}`)
  }

  static async syncEEDM_PN_HIGHEST_PRICE() {
    logger.debug(`----start sync EEDM_PN_HIGHEST_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_HIGHEST_PRICE', updateBy: 'syncEEDM_PN_HIGHEST_PRICE' }

    try {
      let start = new Date()
      // 1. get eedm_pn_request
      logger.debug('1. get partnumber& type1name from eedm_pn_request, epur_tpye1')
      let pn = await eedmModel.getPnRequest()

      if (pn.length == 0) {
        logger.warn('wiprocurement.eedm_pn_request is empty')
        return
      }
      // logger.debug(pn)
      logger.debug('2. get exchange rate from exchange_rate')
      let mrate = await eedmModel.getLatestExchangeRate()
      // logger.debug(mrate)

      // get current price
      logger.debug('3. get current price list by partnumber')
      let pnPriceList = await this.getCurrentPrice(pn.map(e => e.partnumber))

      logger.debug('3.1. filter vendor code')
      let vendorCodeList = await eedmModel.getVendorCode()
      let pnPriceListSortOut = _.filter(pnPriceList, (pn) => vendorCodeList.includes(pn.vendor_code))

      logger.debug('4. group current price by partnumber & purchaseorg')
      let currentPrice = getPriceGroup(pnPriceListSortOut)
      // logger.debug(currentPrice)

      logger.debug('5. get price in each group')
      // 每一個pn 價格
      let currentPriceList = await handleHighestPrice(start, pn, currentPrice, mrate)
      return currentPriceList.length
    } catch (error) {
      logger.error('sync syncEEDM_PN_HIGHEST_PRICE failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_HIGHEST_PRICE----${new Date()}`)
  }

  static async syncEEDM_PN_LOWEST_PRICE() {
    logger.debug(`----start sync EEDM_PN_LOWEST_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_LOWEST_PRICE', updateBy: 'syncEEDM_PN_LOWEST_PRICE' }

    try {
      let start = new Date()
      // 1. get eedm_pn_request
      logger.debug('1. get partnumber& type1name from eedm_pn_request, epur_tpye1')
      let pn = await eedmModel.getPnRequest()

      if (pn.length == 0) {
        logger.warn('wiprocurement.eedm_pn_request is empty')
        return
      }
      // logger.debug(pn)
      logger.debug('2. get exchange rate from exchange_rate')
      let mrate = await eedmModel.getLatestExchangeRate()
      // logger.debug(mrate)

      // get current price
      logger.debug('3. get current price list by partnumber')
      let pnPriceList = await this.getCurrentPrice(pn.map(e => e.partnumber))

      logger.debug('3.1. filter vendor code')
      let vendorCodeList = await eedmModel.getVendorCode()
      let pnPriceListSortOut = _.filter(pnPriceList, (pn) => vendorCodeList.includes(pn.vendor_code))

      logger.debug('4. group current price by partnumber & purchaseorg')
      let currentPrice = getPriceGroup(pnPriceListSortOut)
      // logger.debug(currentPrice)

      logger.debug('5. get price in each group')
      // 每一個pn& purchase org 價格
      let currentPriceList = await handleLowestPrice(start, pn, currentPrice, mrate)
      return currentPriceList.length
    } catch (error) {
      logger.error('sync syncEEDM_PN_LOWEST_PRICE failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_LOWEST_PRICE----${new Date()}`)
  }

  static async syncEEDM_PN_2ND_HIGHEST_PRICE() {
    logger.debug(`----start sync EEDM_PN_2ND_HIGHEST_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_PN_2ND_HIGHEST_PRICE', updateBy: 'syncEEDM_PN_2ND_HIGHEST_PRICE' }

    try {
      let start = new Date()
      // 1. get eedm_pn_request
      logger.debug('1. get partnumber& type1name from eedm_pn_request, epur_tpye1')
      let pn = await eedmModel.getPnRequest()

      if (pn.length == 0) {
        logger.warn('wiprocurement.eedm_pn_request is empty')
        return
      }
      // logger.debug(pn)
      logger.debug('2. get exchange rate from exchange_rate')
      let mrate = await eedmModel.getLatestExchangeRate()
      // logger.debug(mrate)

      // get current price
      logger.debug('3. get current price list by partnumber')
      let pnPriceList = await this.getCurrentPrice(pn.map(e => e.partnumber))

      logger.debug('3.1. filter vendor code')
      let vendorCodeList = await eedmModel.getVendorCode()
      let pnPriceListSortOut = _.filter(pnPriceList, (pn) => vendorCodeList.includes(pn.vendor_code))

      logger.debug('4. group current price by partnumber & purchaseorg')
      let currentPrice = getPriceGroup(pnPriceListSortOut)
      // logger.debug(currentPrice)

      logger.debug('5. get price in each group')
      // 每一個pn& purchase org 價格
      let currentPriceList = await handle2ndHighestPrice(start, pn, currentPrice, mrate)

      return currentPriceList.length
    } catch (error) {
      logger.error('sync syncEEDM_PN_2ND_HIGHEST_PRICE failed', error)
      info.msg = error
      // await sendMail(info)
    }
    logger.debug(`----end sync EEDM_PN_2ND_HIGHEST_PRICE----${new Date()}`)
  }

  static async syncEEDM_SPA_PRICE(startDate, endDate) {
    let vendorFilter = await new vfilter()
    let storeCache = await new cacheStore()
    let cache = []
    logger.debug(`----start sync EEDM_SPA_PRICE----${new Date()}`)
    let info = { typeName: 'syncEEDM_SPA_PRICE', updateBy: 'syncEEDM_SPA_PRICE' }
    try {
      let start = new Date(moment().format())
      let dateTo = moment(endDate).format('YYYY-MM-DD')
      // 取得pn跟rule
      let result = await eedmModel.getPNandRule()
      let count = result.rowCount
      let insertBulkData = []

      logger.debug('pn request length', count)
      if (count > 0) {

        let pallelNum = 20
        let vendorCodeList = await eedmModel.getVendorCode()

        await asyncForEach(result.rows, async (res, idx) => {
          // 取得資料的spec rule
          let spec = onlyGetRule(res)
          logger.debug('call fetchSPA function,', res.partnumber, res.type1, res.type2, spec)
          let spa = await spaService.fetchSPA(res.partnumber, res.type1, res.type2, spec, dateTo, cache, vendorCodeList, storeCache)
          spa = _.omit(spa, ['matnr', 'exp_matnr'])
          spa['update_time'] = moment().utc().format()

          insertBulkData.push(spa)
          if (idx != 0 && idx % pallelNum == 0) {
            // console.log(insertUpdateBulk('wiprocurement.eedm_spa_price', insertBulkData, SPA_COL))
            await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_spa_price', insertBulkData, SPA_COL))
            insertBulkData = []
          }
        })

        if (insertBulkData.length > 0) {
          // console.log(insertUpdateBulk('wiprocurement.eedm_spa_price', insertBulkData, SPA_COL))
          await systemDB.Query(insertUpdateBulk('wiprocurement.eedm_spa_price', insertBulkData, SPA_COL))
        }

        logger.debug(`insert ${count} data into wiprocurement.eedm_spa_price`)
        await systemDB.Query(squel.delete().from('wiprocurement.eedm_spa_price').where('update_time < DATE \'TODAY\'',).toParam())
      } else {
        logger.debug(`no data into wiprocurement.eedm_spa_price on date ${dateTo}`)
      }

      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EEDM_SPA_PRICE', count, new Date(), dura_sec, 'complete', `${startDate}|${endDate}`)
      return count

    } catch (error) {
      logger.error('sync syncEEDM_SPA_PRICE failed', error)
      info.msg = error
      await sendMail(info)
    }
    logger.debug(`----end sync EEDM_SPA_PRICE----${new Date()}`)
  }

  static async get_EEDM_SPA_PRICE_BY_PN(partnumber) {
    let vendorFilter = await new vfilter()
    let storeCache = await new cacheStore()
    let cache = []
    logger.debug(`----start get EEDM_SPA_PRICE ----${new Date()} by Partnumber`, partnumber)

    try {
      let start = new Date(moment().format())
      let dateTo = moment().format('YYYY-MM-DD')

      // 取得pn跟rule
      let result = await eedmModel.getPNandRule([partnumber])
      let count = result.rowCount

      if (count > 0) {
        let res = result.rows[0]
        logger.debug(res, 'from getPNandRule function')
        // await asyncForEach(result.rows, async (res, idx) => {
        // 取得資料的spec rule
        let spec = onlyGetRule(res)
        logger.debug('call fetchSPA function,', res.partnumber, res.type1, res.type2, spec, dateTo)

        let spa = await spaService.fetchSPA(res.partnumber, res.type1, res.type2, spec, dateTo, cache, vendorFilter, storeCache)
        spa['update_time'] = moment().format()

        return spa
      } else {
        logger.debug(`no data into wiprocurement.eedm_spa_price on date ${dateTo} and partnumber`, partnumber)
      }

    } catch (error) {
      logger.error('sync syncEEDM_SPA_PRICE failed', error)
    }
    logger.debug(`----end get EEDM_SPA_PRICE ----${new Date()} by Partnumber`, partnumber)
  }

  static async get_EEDM_ALT_PRICE_BY_PN(partnumber) {
    let start = new Date()

    logger.debug(`---- start syncSAP_ALT_PN ----${new Date()}`, partnumber)
    let info = { typeName: 'syncSAP_ALT_PN', updateBy: 'syncSAP_ALT_PN' }

    try {
      let storeCache = await new cacheStore()

      // 2. 取得pn from eedm_pn_request
      let pnRuquest = await eedmModel.getPnRequest(partnumber)
      let res = []
      console.log(pnRuquest.length)
      if (pnRuquest.length > 0) {
        for (let i = 0; i < pnRuquest.length; i++) {
          let pnRuq = pnRuquest[i]
          logger.debug('start to get alt partnumber, and pn request length')
        
            if (pnRuq.type1name) {
            // 3. 找到所有的相似料
            // let altItemGroup = await altpartModel.getAltItemGroup(pnRuq.partnumber)
            logger.debug(pnRuq.partnumber, pnRuq.type1name)
            let altParts = await altpartModel.getAltItemsByGroup(pnRuq.partnumber, pnRuq.type1name)
            logger.debug('get alt partnumber length', pnRuq.partnumber, altParts.length)

            if (altParts.length > 0) {
              // 4. 計算last price 找到最低價的料
              logger.debug('getAltLowestPrice: get alt lowest price', pnRuq.partnumber, altParts)
              let altRes = await altService.getAltLowestPrice(pnRuq, storeCache, altParts)
              console.log(altRes)
              // logger.debug('done: get alt lowest price by partnumber', pnRuq.partnumber, altParts)
              // return altRes
              res.push(altRes)
            }
          }
        }
        return res
      }
    } catch (error) {
      logger.error('sync get_EEDM_ALT_PRICE_BY_PN failed', error)
      info.msg = error
      // await sendMail(info)
    }
    logger.debug(`---- end get_EEDM_ALT_PRICE_BY_PN ----${new Date()}`)
  }

  static async getALT_GROUP_PRICE_BY_PN(pn_list) {
    let pn_list_with_type = await altpartModel.getAltItemTypeI(pn_list)
    let group_pn = await altpartModel.getAltItemGroupAndTypeI(pn_list)
    let res = []
    await asyncForEach(pn_list_with_type, async(pn_with_type) => {
    // let res = _.map(pn_list, (partnumber) => {
      let partnumber = pn_with_type.partnumber
      let type1 = pn_with_type.type1name

      let pn_request = _.find(group_pn, (pn) => pn.item_num == partnumber)
      if (pn_request && type1) {
        let pn_group = _.filter(group_pn, (pn) => pn.item_group == pn_request.item_group && pn.type1name && pn.type1name.toLowerCase() == type1.toLowerCase())

        let priceList = await this.getEEDM_PN_LOWEST_PRICE_BY_PN(_.map(pn_group, 'item_num'))

        res.push({
          main_pn: partnumber,
          main_pn_type1: type1,
          group: _.map(pn_group, (g) => {
            let price = _.find(priceList, (p) => p.partnumber == g.item_num)
            if (price) {
              return {
                group_pn: g.item_num,
                group_pn_type1: g.type1name,
                ...price,
              }
            } else {
              return {
                group_pn: g.item_num,
                group_pn_type1: g.type1name,
              }
            }
          }),
        })
      } else {
        res.push({
          main_pn: partnumber,
          main_pn_type1: type1,
          group: [],
        })
      }
    })

    return res
  }

  static async getEEDM_PN_LOWEST_PRICE_BY_PN(pn_list) {
    logger.debug(`----start sync getEEDM_PN_LOWEST_PRICE_BY_PN----${new Date()}`)
    let info = { typeName: 'getEEDM_PN_LOWEST_PRICE_BY_PN', updateBy: 'getEEDM_PN_LOWEST_PRICE_BY_PN' }

    try {
      let start = new Date()
      // 1. get eedm_pn_request
      logger.debug('1. get partnumber& type1name from eedm_pn_request, epur_tpye1', pn_list)
      let pn = await eedmModel.getPnType(pn_list)
      logger.debug('getPnRequest', pn)

      if (pn.length == 0) {
        logger.warn('wiprocurement.eedm_pn_request is empty')
        return
      }

      logger.debug('2. get exchange rate from exchange_rate')
      let mrate = await eedmModel.getLatestExchangeRate()
      // logger.debug(mrate)

      // get current price
      logger.debug('3. get current price list by partnumber')
      let pnPriceList = await this.getCurrentPrice(pn.map(e => e.partnumber))
      // console.log('pnPriceList', pnPriceList)

      logger.debug('3.1. filter vendor code')
      let vendorCodeList = await eedmModel.getVendorCode()
      let pnPriceListSortOut = _.filter(pnPriceList, (pn) => vendorCodeList.includes(pn.vendor_code))

      logger.debug('4. group current price by partnumber & purchaseorg')
      let currentPrice = getPriceGroup(pnPriceListSortOut)
      // logger.debug(currentPrice)

      logger.debug('5. get price in each group')
      // 每一個pn& purchase org 價格
      let currentPriceList = await handleLowestPriceForTest(start, pn, currentPrice, mrate)
      return currentPriceList

    } catch (error) {
      logger.error('getEEDM_PN_LOWEST_PRICE_BY_PN failed', error)
      info.msg = error
      // await sendMail(info)
    }
    logger.debug(`----end get EEDM_PN_LOWEST_PRICE_BY_PN----${new Date()}`)
  }
  /**
   * 處理eprocurement送來的pcb同步結果
   * @param {Boolean} isSuccess 是否成功
   * @param {String} message 訊息
   */
  static async pcbSyncResult(isSuccess, message){
    if(!isSuccess){
      await sendMail({
        typeName: 'API - pcbSyncResult',
        updateBy: 'API - pcbSyncResult',
        msg: message,
      })
    }
  }
}
/**
 * 預處理 wiprocurement.eedm_pn_request 的料號最低價，insert to wiprocurement.eedm_pn_lowest_price
 */
const handleLowestPriceForTest = async (startTime, pnList, currentPrice, mrate) => {
  logger.debug('handleLowestPrice:', 'get the lowest price in each group')

  let types = ['MLCC', 'OTHERS', 'RES']
  let currentPriceByType = filterTypeList(pnList, currentPrice, types)
  let currentPriceList = getCurrentPriceList(pnList, currentPriceByType, mrate, 'min')

  return currentPriceList
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}
/**
 * @param {Object} condition Request.body的條件
 * @returns {Object} 回傳兩組SQL
 */
function prepare_syncEEBomBase_SQL(condition) {
  let baseSQL = squel.select().from('wiprocurement.eedm_cost_summarytable')
  let whereSQL = squel.expr()
  if (condition && Object.keys(condition).length > 0) {
    logger.debug('Specific condition mode:', condition)
    if (condition.keyid) whereSQL.and('keyid=?', condition.keyid)
    if (condition.pcbno) whereSQL.and('pcbno=?', condition.pcbno)
    if (condition.stage) whereSQL.and('stage=?', condition.stage)
    if (condition.sku) whereSQL.and('sku=?', condition.sku)
    if (condition.projectcode) whereSQL.and('projectcode=?', condition.projectcode)
    if (condition.uploadtime) whereSQL.and('uploadtime=?', condition.uploadtime)
    if (condition.eedmuploadtime) whereSQL.and('eedmuploadtime=?', condition.eedmuploadtime)
    if (condition.platform) whereSQL.and('platform=?', condition.platform)
    if (condition.panel_size) whereSQL.and('panel_size=?', condition.panel_size)
  } else {
    whereSQL.and('update_time IS NULL')  // 找未處理過的
  }
  baseSQL.where(whereSQL)
  let updateSQL = squel.update().table('wiprocurement.eedm_cost_summarytable').set('update_time', 'NOW()').where(whereSQL)
  return { selectSQL: baseSQL, updateSQL: updateSQL }
}

const forPromiseAll = async (elements, asyncFunc, pallelNum = 100, endDate) => {
  let idx = 0
  let dateTo = moment(endDate).format('YYYY-MM-DD')

  while (idx < elements.length) {
    let selectedElms
    if ((idx + pallelNum) < elements.length) {
      selectedElms = elements.slice(idx, (idx + pallelNum))
    } else {
      selectedElms = elements.slice(idx)
    }

    let res = await Promise.all(selectedElms.map(elm => {

      let specRules = _.omit(elm, 'partnumber', 'type1', 'type2')
      let spec = Object.keys(specRules).filter(k => {
        if (elm[k] == 'Y') return k
      })

      return asyncFunc(elm.partnumber, elm.type1, elm.type2, spec, dateTo)
    }))

    let data = res.map(r => {
      r['update_time'] = moment().utc().format()
      return r
    })

    // await insertUpdateBulk('wiprocurement.eedm_spa_price', data, SPA_COL)
    await systemDB.Query(await insertUpdateBulk('wiprocurement.eedm_spa_price', data, SPA_COL))
    idx += pallelNum
  }
  return true
}

const insertUpdateBulk = (table, datas, col) => {

  let sql = squel.insert().into(table).setFieldsRows(datas)
  let tableName = table.split('wiprocurement.')[1]

  let onConflictClause = ` ON CONFLICT ON CONSTRAINT ${tableName}_pkey DO UPDATE SET `

  col.forEach((c, idx) => {
    if (idx == col.length - 1) {
      onConflictClause += `${c}=EXCLUDED.${c}`
    } else {
      onConflictClause += `${c}=EXCLUDED.${c}, `
    }
  })

  return sql.toString() + onConflictClause
}

const insertUpdateKeyBulk = (table, datas, col, keys) => {

  let sql = squel.insert().into(table).setFieldsRows(datas)

  let onConflictClause = ` ON CONFLICT (${keys.join(',')}) DO UPDATE SET `

  col.forEach((c, idx) => {
    if (idx == col.length - 1) {
      onConflictClause += `${c}=EXCLUDED.${c}`
    } else {
      onConflictClause += `${c}=EXCLUDED.${c}, `
    }
  })

  return sql.toString() + onConflictClause
}

const insertBulk = (table, datas) => {
  let sql = squel.insert().into(table).setFieldsRows(datas)
  return sql.toString()
}

const getProjects = (pcodes) => {
  let para = (pcodes.length > 0) ? pcodes : ['']
  return squel.select().from('wiprocurement.all_pmprjtbl_for_dashboard').where('projectname in ?', para).toParam()
}

const getRFQProjects = (pcodes) => {
  let para = (pcodes.length > 0) ? pcodes : ['']
  return squel.select().from('wiprocurement.all_rfqproject_for_dashboard').where('project_code in ?', para).toParam()
}

const getVersions = (ids) => {
  let para = (ids.length > 0) ? ids : ['']
  return squel.select().from('wiprocurement.edm_version').where('eebom_project_id in ?', para).toParam()
}

class Project {
  constructor(data) {
    this.id = data.hasOwnProperty('id') ? data.id : null
    this.project_code = data.hasOwnProperty('project_code') ? data.project_code : null
    this.customer = data.hasOwnProperty('customer') ? data.customer : null
    this.product_type = data.hasOwnProperty('product_type') ? data.product_type : null
    this.project_name = data.hasOwnProperty('project_name') ? data.project_name : null
    this.stage = data.hasOwnProperty('stage') ? data.stage : null
    // this.version = data.hasOwnProperty('version') ? data.version : null
    this.sku = data.hasOwnProperty('sku') ? data.sku : null
    this.version_remark = data.hasOwnProperty('version_remark') ? data.version_remark : null
    this.project_leader = data.hasOwnProperty('project_leader') ? data.project_leader : null
    // this.eedm_version = data.hasOwnProperty('eedm_version') ? data.eedm_version : null
    // this.is_eedm_version_edit = data.hasOwnProperty('is_eedm_version_edit') ? data.is_eedm_version_edit : null
    this.plant = data.hasOwnProperty('plant') ? data.plant : null
    this.purchasing_organization = data.hasOwnProperty('purchasing_organization') ? data.purchasing_organization : null
    this.create_time = data.hasOwnProperty('create_time') ? data.create_time : 'NOW()'
    this.caculation_date = data.hasOwnProperty('caculation_date') ? data.caculation_date : null
    this.update_time = data.hasOwnProperty('update_time') ? data.update_time : 'NOW()'
    this.platform = data.hasOwnProperty('platform') ? data.platform : null
    this.panel_size = data.hasOwnProperty('panel_size') ? data.panel_size : null
    this.pcbno = data.hasOwnProperty('pcbno') ? data.pcbno : null
  }
  static insertBulk(datas) {
    let sql = squel.insert().into('wiprocurement.eebom_projects').setFieldsRows(datas)
    return sql.toString()
  }
}

class Version {
  constructor(data) {
    this.id = data.hasOwnProperty('id') ? data.id : null
    this.version = data.hasOwnProperty('version') ? data.version : null
    this.eebom_project_id = data.hasOwnProperty('eebom_project_id') ? data.eebom_project_id : null
    this.upload_time = data.hasOwnProperty('upload_time') ? data.upload_time : null
  }
  static insertBulk(datas) {
    let sql = squel.insert().into('wiprocurement.edm_version').setFieldsRows(datas)
    return sql.toString()
  }
}


module.exports = Eedm
