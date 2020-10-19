const _ = require('lodash')
const moment = require('moment')
const xrayModel = require('../model/spa.js')
const { supplyType: supplyTypeConfig } = require('../../config')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('SPA service')
const cacheService = require('./storecache.js')
const commonLogical = require('../utils/common/logical.js')
const commonCalculate = require('../utils/common/calculate.js')
const { fixedPoint } = require('../utils/common/math.js')

/**
 * cache的key 將typeI typeII 與spec 做字串串接
 * @param {string} type1 'type1'
 * @param {string} type2 'type2'
 * @param {object} specItems '{spect01=DIP, spec02=WIREWOUND, ...}'
 *
 * @returns {string} 回傳typeI&typeII&spec的字串
 */
const combineStringForCache = (type1, type2, specItems) => {
  let specString = `type1=${type1}&type2=${type2}`
  Object.keys(specItems).map((k) => {
    let num = k.split('spec')[1]
    if (specItems[k] != null) {
      specString += `&spec${Number(num)}=${specItems[k]}`
    }
  })
  return specString
}

/**
 * 拿到最小價格的料號資料
 * @param {array} materialList 'array中會有多個object, object內有這個料號的資訊'
 *
 * @returns {array} 回傳最小價格的料號資料 ex: [{ spa_price: 0.001, spa_partnumber: '64.10715.55L', manufacturer: '[ "TAI" ]', expiry_date: '2099-12-31'}]
 */
const getMinPrice = async (materialList) => {
  let collatePriceList = commonLogical.collatePrice(materialList)
  let minPrice = _.min(Object.keys(collatePriceList))
  let listCollatedByCMP = await commonLogical.CommonPartByPreferredOrder(collatePriceList[minPrice])

  // order by Wistron partnumber 由小至大
  let lowerPartnumber = _.chain(listCollatedByCMP)
    .orderBy('partNumber', ['asc'])
    .groupBy(m => m.partNumber)
    .map((v, k) => {
      let original = commonLogical.originalByPreferredOrder(v)

      // let original = _.chain(v).sortBy(c => c.originalCurrency).value()
      return {
        spa_price: minPrice,
        spa_partnumber: k,
        matnr: _.map(v, 'matnr'),
        manufacturer: JSON.stringify(_.chain(v)
          .map('manufacturer')
          .uniq()
          .slice(0, 3)
          .value()),
        original_currency: original.originalCurrency,
        original_spa_price: fixedPoint(original.originalUnitPrice, 5),
        expiry_date: _.minBy(v, ['datbi']).datbi,
        valid_from: original.valid_from,
      }
    })
    .slice(0, 1)
    .value()

  return lowerPartnumber[0]
}

/*
 * 取得supplytype mapping的nui key
 * @returns {Array} keys in array
 */
const getSupplyTypeKeys = async () => {
  let supplyTypes = await xrayModel.getSupplyTypeMapping()
  return _.uniq(supplyTypes.map(e => e.key))
}

class SPA {

  static async fetchSPA(partNumber, type1, type2, spec, dateTo, cache, vendorFilter, storeCache) {
    // // Sample usage for VendorFilter
    // let vendorFilter = await new VendorFilter()
    // console.log('check 0000606379 is Filtered ?', vendorFilter.isFiltered('0000606379'))
    // console.log('check 12345 is Filtered ?', vendorFilter.isFiltered('12345'))

    let spa_result = {
      spa_price: null,
      spa_partnumber: null,
      manufacturer: JSON.stringify([]),
      original_currency: null,
      original_spa_price: null,
      valid_from: null,
      similar_info: JSON.stringify([]),
    }

    let exp_spa_result = {
      exp_spa_price: null,
      exp_spa_partnumber: null,
      exp_manufacturer: JSON.stringify([]),
      expire_time: null,
    }

    if (spec.length > 0) {
      // P/N, spec N ~ M => spec items
      let specItems = await xrayModel.getSpecByPartNumber(partNumber, spec)
      let materialList = []
      let specString = null
      // get 相似料號
      if (!_.isEmpty(specItems)) {

        // get cache key
        specString = combineStringForCache(type1, type2, specItems)

        let findObject = storeCache.findSameKey(specString)
        if (!_.isEmpty(findObject)) {
          return _.assign({ partnumber: partNumber }, findObject)
        }

        let materialItems = await xrayModel.getItembySpec(Object.keys(supplyTypeConfig), type1, type2, specItems)
        let similarPN = _.chain(materialItems).map('partNumber').uniq().value()

        // filter OBS 料號
        similarPN = await commonLogical.filterOBS(similarPN)

        if (similarPN.length > 0) {
          // get wistron part number & getManufacturer & price
          materialList = await xrayModel.getMinPartnumber(similarPN, vendorFilter)
        }
      }

      if (materialList.length > 0) {

        // unitPrice : if currency diff, exchange currency into USD
        let currencies = _.chain(materialList)
          .map('currency')
          .uniq()
          .filter(c => c != 'USD')
          .value()

        let exchangeRate = []
        if (currencies.length > 0) {
          exchangeRate = await xrayModel.getExchangeRate(moment(new Date(dateTo)).format('YYYYMMDD'), currencies)
        }
        // 轉換匯率
        materialList = commonCalculate.calculatePrice(materialList, exchangeRate)

        // 尋找 expire 料號納入比較 的最低價
        let exp_restult = await commonCalculate.getSpaMinPrice(materialList)
        exp_spa_result = {
          exp_spa_price: exp_restult.spa_price,
          exp_spa_partnumber: exp_restult.spa_partnumber,
          exp_manufacturer: exp_restult.manufacturer,
          expire_time: exp_restult.expiry_date,
          exp_matnr: exp_restult.matnr,
        }

        // 尋找最低價
        let formatDate = moment(new Date(dateTo)).format('YYYY-MM-DD')
        let materialListWithOutEXP = _.filter(materialList, (m) => m.datbi >= formatDate)

        if(materialListWithOutEXP.length > 0) {
          spa_result = await commonCalculate.getSpaMinPrice(materialListWithOutEXP)
          spa_result = _.omit(spa_result, ['expiry_date'])
        }

        // 將相似料號的資訊紀錄. include MLCC-DIP, RES-Thermistor
        if ((type1.toLowerCase() == 'res' && type2.toLowerCase() != 'thermistor') ||
        type1.toLowerCase() == 'mlcc' && type2.toLowerCase() != 'dip') {
          spa_result.similar_info = JSON.stringify([])
        } else {
          spa_result.similar_info = JSON.stringify(materialListWithOutEXP)
        }

        storeCache.storeCache(specString, spa_result, exp_spa_result)

        return _.assign({ partnumber: partNumber }, spa_result, exp_spa_result)
      }

      logger.warn('fetchSPA: get MinPartnumber return empty array, ', partNumber, type1, type2)
    } else {
      logger.warn('fetchSPA: spec rules is empty, ', partNumber, spec)
    }
    return _.assign({ partnumber: partNumber }, spa_result, exp_spa_result)
  }
}

// class VendorFilter {
//   constructor() {
//     this.isFiltered = function (vcode) {
//       let result = _.find(this.value, ['vendor_code', vcode])
//       if (!result) return true
//       else return false
//     }
//     return (async () => {
//       // All async code here
//       this.value = await xrayModel.getVendorFilter()
//       return this // when done
//     })()
//   }
// }
module.exports = SPA
