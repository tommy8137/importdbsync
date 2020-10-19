const _ = require('lodash')
const moment = require('moment')
const altModel = require('../model/altpart.js')
const xrayModel = require('../model/spa.js')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('ALT service')
const commonLogical = require('../utils/common/logical.js')
const commonCalculate = require('../utils/common/calculate.js')
// const { fixedPoint } = require('../utils/common/math.js')
const UUID = require('uuid/v4')
const { asyncForEach } = require('../utils/common/utils')


/**
 * cache的key 將typeI typeII 與spec 做字串串接
 * @param {string} type1 'type1'
 * @param {string} type2 'type2'
 * @param {object} specItems '{spect01=DIP, spec02=WIREWOUND, ...}'
 *
 * @returns {string} 回傳typeI&typeII&spec的字串
 */
const combineStringForCache = (partnumbers) => {
  return _.sortedUniq(partnumbers).join(',')
}

const genAltGroup = (altItems) => {
  let altGroup = []

  _.chain(altItems)
    .groupBy(alt => alt.item_group)
    .forEach((items) => {

      let uuid = UUID()
      _.forEach(items, (item) => {
        altGroup.push({
          // ...item,
          item_num: item.item_num,
          item_group: uuid,
          update_time: item.update_time ? moment(item.update_time).format('YYYY-MM-DD HH:mm:ssZZ') : null,
          group_update_time: moment().format('YYYY-MM-DD HH:mm:ssZZ'),
        })
      })
    })
    .value()

  return altGroup
}

/**
 *
  item_num varchar(20),
  alt_num varchar(20),
  lowest_price numeric,
  origin_lowest_price numeric,
  currency varchar(20),
  origin_currency varchar(20),
  manufacturer varchar(50),
  valid_from date,
  grouping varchar(100),
 */
class Alt {
  static async getAltLowestPrice(item, storeCache, partnumbers = []) {

    let partNumber = item.partnumber
    let type1 = item.type1name
    let type2 = item.type2name

    // 找出 partnumbers 中的最低價
    let lowestRes = {
      item_num: partNumber,
      alt_num: null,
      lowest_price: null,
      origin_lowest_price: null,
      currency: null,
      origin_currency: null,
      manufacturer: null,
      grouping: JSON.stringify(partnumbers),
      similar_info: JSON.stringify([]),
      vendor_pn: null,
    }
    let lowestList = []

    let lowestResWithoutMainPn = {
      alt_num_without_main_pn: null,
      lowest_price_without_main_pn: null,
      origin_lowest_price_without_main_pn: null,
      currency_without_main_pn: null,
      origin_currency_without_main_pn: null,
      manufacturer_without_main_pn: null,
      valid_from_without_main_pn: null,
      similar_info_without_main_pn: JSON.stringify([]),
      vendor_pn_without_main_pn: null,
    }

    // filter alt partnumber supply type = A, B, C
    partnumbers = await commonLogical.filterSuppyType(partnumbers)

    // filter alt partnumber is blocked
    partnumbers = await commonLogical.filterOBS(partnumbers)

    if (partnumbers.length > 0) {
      logger.debug(partNumber, 'getAltLowestPrice function start, and alt partnumbers', partnumbers)
      let pnsString = combineStringForCache(partnumbers)

      // cache
      let findObject = storeCache.findSameKey(pnsString)
      if (!_.isEmpty(findObject)) {
        // 拿到cache的資料後 回傳
        logger.debug('拿到cache的資料後 回傳')
        if (findObject.minPriceList && findObject.minPriceList.length > 0) {
          let withoutMainPnRes = await commonCalculate.getAltMinPrice(findObject.minPriceList, partNumber)
          if (withoutMainPnRes) {
            lowestResWithoutMainPn = {
              alt_num_without_main_pn: withoutMainPnRes.alt_num,
              lowest_price_without_main_pn: withoutMainPnRes.lowest_price,
              origin_lowest_price_without_main_pn: withoutMainPnRes.origin_lowest_price,
              currency_without_main_pn: withoutMainPnRes.currency,
              origin_currency_without_main_pn: withoutMainPnRes.origin_currency,
              manufacturer_without_main_pn: withoutMainPnRes.manufacturer,
              valid_from_without_main_pn: withoutMainPnRes.valid_from,
              vendor_pn_without_main_pn: withoutMainPnRes.vendor_pn,
            }
          }
        }

        let filterMainPn = _.filter(JSON.parse(findObject.similar_info), (info) => info.partNumber != partNumber)
        lowestResWithoutMainPn.similar_info_without_main_pn = JSON.stringify(filterMainPn)
        return _.assign({ item_num: partNumber }, _.omit(findObject, ['minPriceList']), lowestResWithoutMainPn)
      }

      // 找到 這些替代料的最低價(USD, NTD, RMB), 如果這些料 沒有合理價格裡面的最低價的話 return 預設值
      let altPriceList = await altModel.getAltLowestPrice(partnumbers)

      // 轉匯率, 記住原始的幣別跟價格
      if (altPriceList.length > 0) {
        // 找最低價
        // unitPrice : if currency diff, exchange currency into USD
        let currencies = _.without(_.uniq(_.map(altPriceList, 'currency')), 'USD')

        let exchangeRate = []
        if (currencies.length > 0) {
          exchangeRate = await xrayModel.getExchangeRate(moment(new Date()).format('YYYYMMDD'), currencies)
        }

        lowestList = commonCalculate.calculatePrice(altPriceList, exchangeRate)

        lowestRes = await commonCalculate.getAltMinPrice(lowestList)

        let withoutMainPnRes = await commonCalculate.getAltMinPrice(lowestList, partNumber)
        if (withoutMainPnRes) {
          lowestResWithoutMainPn = {
            alt_num_without_main_pn: withoutMainPnRes.alt_num,
            lowest_price_without_main_pn: withoutMainPnRes.lowest_price,
            origin_lowest_price_without_main_pn: withoutMainPnRes.origin_lowest_price,
            currency_without_main_pn: withoutMainPnRes.currency,
            origin_currency_without_main_pn: withoutMainPnRes.origin_currency,
            manufacturer_without_main_pn: withoutMainPnRes.manufacturer,
            valid_from_without_main_pn: withoutMainPnRes.valid_from,
            vendor_pn_without_main_pn: withoutMainPnRes.vendor_pn,
          }
        }

        // 將相似料號的資訊紀錄. include MLCC-DIP, RES-Thermistor
        if ((type1 && type2 && type1.toLowerCase() == 'res' && type2.toLowerCase() != 'thermistor') ||
        type1 && type2 && type1.toLowerCase() == 'mlcc' && type2.toLowerCase() != 'dip') {
          lowestRes.similar_info = JSON.stringify([])
          lowestResWithoutMainPn.similar_info_without_main_pn = JSON.stringify([])
        } else {
          lowestRes.similar_info = JSON.stringify(altPriceList)
          lowestResWithoutMainPn.similar_info_without_main_pn = JSON.stringify(_.filter(altPriceList, (alt) => alt.partNumber != partNumber))
        }
      }

      // 塞cache
      storeCache.storeCache(pnsString, _.assign({}, lowestRes, { grouping: JSON.stringify(partnumbers) }), { minPriceList: lowestList })

      return _.assign({ item_num: partNumber }, lowestRes, { grouping: JSON.stringify(partnumbers) }, lowestResWithoutMainPn)
    }

    logger.warn('alt partnumbers array is empty', partNumber)
    // TODO return 預設值
    return _.assign({}, lowestRes, lowestResWithoutMainPn)
  }

  static async createALT_Group() {
    logger.debug('從原始資料將item, alt_item 組成一個group')
    let altItems = await altModel.getAltItemTempGroup()
    let altGroup = genAltGroup(altItems)

    logger.debug('將group 資料塞進 alt_group中')
    await altModel.truncateAltItemGroup()
    await altModel.createAltItemGroup(altGroup)

    logger.debug('取出item count > 1, 代表item 存在在多個群組中')
    let items = await altModel.getAltItems()

    logger.debug('upsert item group, 第二次加工, 將item 屬於不同group 改組合成同一個群組')
    await asyncForEach(items, async(item) => {
      // let group_list = await altModel.getAltItemGroup(item.item_num)

      // if (group_list.length > 1) {
      //   await altModel.upsertAltItemGroup(group_list)
      // }
      logger.debug('update', item.item_num, 'groups')
      await altModel.upsertAltItemGroups(item.item_num)
    })

    logger.debug(`${new Date()} done: createALT_Group`, items.length)
  }

  static async updateALT_Group() {
    let start = new Date()
    logger.debug(`${start} start: updateALT_Group`)
    // 每天要重跑 alt group
    await altModel.truncateAltItemGroup()

    // 只能需要更新的item, 所以要先拿到之前最大的更新日期
    // let maxTime = await altModel.getAltGroupMaxUpdateTime()
    let condiTime = null
    // if (maxTime) {
    //   logger.debug('只能需要更新的item, 所以要先拿到之前最大的更新日期', moment(maxTime).add(1, 'seconds').format('YYYY-MM-DD HH:mm:ss'))
    //   condiTime = moment(maxTime).add(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
    // }
    let altItems = await altModel.getAltItemTempGroup(condiTime)

    logger.debug('sapalt 中有需要更新的料號', altItems.length)
    if (altItems.length > 0) {

      logger.debug('從資料將item, alt_item 組成一個group')
      let itemByGroup = _.groupBy(altItems, (alt) => alt.item_group)

      await asyncForEach(Object.keys(itemByGroup), async(groupId) => {

        // get item 是否存在 sapalt_group中
        let newAltItems = _.map(itemByGroup[groupId], 'item_num')

        let altOriginalGroup = await altModel.getAltOriginalGroup(newAltItems)

        if (altOriginalGroup.length > 0) {
          // sapalt_group中, 這筆需要新增的item
          logger.debug('sapalt_group中, 有這筆需要新增的item', newAltItems)

          let insertAltGroupItems = genAltGroupByOrigin(itemByGroup[groupId], altOriginalGroup)
          if (insertAltGroupItems.length > 0) {

            if (insertAltGroupItems.length >= 2) {
              logger.debug('兩筆item, 存在在不同group中, upsertMulitAltItemGroups')
              await altModel.upsertMulitAltItemGroups(insertAltGroupItems[0].item_group, _.map(altOriginalGroup, 'item_group'))
            } else {
              await altModel.createAltItemGroup(insertAltGroupItems)
            }
          }
        } else {
          // 需要新增的item, 皆不存在 sapalt_group中
          logger.debug('需要新增的item, 皆不存在 sapalt_group中', newAltItems)
          let altGroup = genAltGroup(itemByGroup[groupId])
          await altModel.createAltItemGroup(altGroup)
        }
      })
    }

    let end = new Date()
    logger.debug(`${end} done: updateALT_Group`, altItems.length, 'during:', end - start)
    return altItems.length
  }
}


const genAltGroupByOrigin = (newAltItems, originAltItems) => {
  let insertAltGroupItems = []
  // let needToUpsert = false
  if (originAltItems.length == 2) {

    if(originAltItems[0].item_group != originAltItems[1].item_group) {
      // 兩個都存在 group中, 但屬於不同gruop, 所以要將原本的2組 group 都更新為一樣的group id
      logger.debug('兩個都存在 group中, 但屬於不同gruop, 要將group 更新為一樣的')
      let uuid = UUID()
      _.forEach(newAltItems, (item) => {
        insertAltGroupItems.push({
          item_num: item.item_num,
          item_group: uuid,
          update_time: item.update_time ? moment(item.update_time).format('YYYY-MM-DD HH:mm:ssZZ') : null,
          group_update_time: moment().format('YYYY-MM-DD HH:mm:ssZZ'),
        })
      })
      // needToUpsert = true
    } else {
      // else 兩個都存在 group中, 屬於同一個gruop, 所以不動作
      logger.debug('else 兩個都存在 group中, 屬於同一個gruop, 所以不動作')
    }
  } else {
    // 如果其中一個存在 group中, 要讓不存在的item 成為同一個 group
    logger.debug('其中一個存在 group中, 要讓不存在的item 成為同一個 group')
    if(_.find(originAltItems, (o) => o.item_num == newAltItems[0].item_num)) {
      logger.debug('newAltItems[1].item_num不存在')
      insertAltGroupItems.push({
        item_num: newAltItems[1].item_num,
        item_group: originAltItems[0].item_group,
        update_time: newAltItems[1].update_time ? moment(newAltItems[1].update_time).format('YYYY-MM-DD HH:mm:ssZZ') : null,
        group_update_time: moment().format('YYYY-MM-DD HH:mm:ssZZ'),
      })
    } else {
      logger.debug('newAltItems[0].item_num不存在')
      insertAltGroupItems.push({
        item_num: newAltItems[0].item_num,
        item_group: originAltItems[0].item_group,
        update_time: newAltItems[0].update_time ? moment(newAltItems[0].update_time).format('YYYY-MM-DD HH:mm:ssZZ') : null,
        group_update_time: moment().format('YYYY-MM-DD HH:mm:ssZZ'),
      })
    }
  }
  return insertAltGroupItems
}
module.exports = Alt
