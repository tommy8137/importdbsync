// 邏輯判斷 for spa and alt
const _ = require('lodash')
const { supplyType: supplyTypeConfig } = require('../../../config')
const edmModel = require('../../model/eedm.js')
const { fixedPoint } = require('./math.js')

const currencyPreferredOrder = ['USD', 'NTD', 'RMB', 'JPY']

/**
 * original currency 依照'USD'->'NTD'->'RMB'->'JPY' 做優先序的選擇
 * @param {*} arr
 */
const originalByPreferredOrder = (arr) => {
  for (let i = 0; i < currencyPreferredOrder.length; i++){
    let inOrderArr = _.find(arr, (a) => a.originalCurrency == currencyPreferredOrder[i])
    if(inOrderArr) {
      return (inOrderArr)
    }
  }
  return arr[0]
}

/**
 * 過濾 supply type為A, B, C的相似料號
 * @param {*} partnumbers 原始相似料號list
 */
const filterSuppyType = async (partnumbers) => {
  let FilterSupplyTypeRes = await edmModel.getSuppyType(Object.keys(supplyTypeConfig), partnumbers)
  return _.map(FilterSupplyTypeRes, 'matnr')
}

/**
 * 過濾 被block的 相似料號
 * @param {Array} partnumbers 原始相似料號list
 * @returns {Array}
 */
const filterOBS = async (partnumbers) => {
  if (partnumbers.length > 0) {
    let blockPN = await edmModel.isItemBlock(partnumbers)
    blockPN = _.map(blockPN, 'partnumber')
    return _.filter(partnumbers, (pn) => !_.includes(blockPN, pn))
  }
  return []
}

/**
 * 如果為partnumber為多個, 優先選擇 partnumber為CMP的優先
 * @param {Array} partnumbers 最低價的partnumber list
 * @returns {Array}
 */

const CommonPartByPreferredOrder = async (items) => {
  let partnumbers = _.map(items, 'partNumber')
  let cmpRes = await edmModel.getCommonPartByPN(partnumbers)
  let cmpList = _.map(cmpRes, 'partnumber')

  let flag = false
  _.forEach(items, (item) => {
    if (_.includes(cmpList, item.partNumber)) {
      item['cmp'] = true
      flag = true
    } else {
      item['cmp'] = false
    }
  })

  if (flag) {
    items = _.filter(items, (item) => item.cmp)
  }

  // _.forEach(items, item => delete item.cmp)
  return items
}

/**
 *
 * @param {*} items
 *
 * @returns ex: {
  '0.1': [{
    "partNumber": '5260031400G',
    "matnr": "MPN02927184",
    "datab": "2019-02-10T16:00:00.000Z",
    "unitPrice": 0.00001,
    ...
  }],
  '0.2': [{
    "partNumber": '5260031400G',
    "matnr": "MPN02927184",
    "datab": "2019-02-10T16:00:00.000Z",
    "unitPrice": 0.00001,
    ...
  }]
 }
 */
const collatePrice = (items) => {
  let minList = _.chain(items)
    .sortBy(m => m.unitPrice)
    .uniq()
    .map(v => {
      v.unitPrice = fixedPoint((v.unitPrice), 5)
      v.originalUnitPrice = fixedPoint((v.originalUnitPrice), 5)
      return v
    })
    .groupBy(m => m.unitPrice)
    .value()

  return minList
}

/**
 * 判斷料號 屬於 'MLCC', 'RES', or 'OTHERS'
 * @param {*} detail
 */
const determineType = (partnumber, type1name, type2name) => {
  let type = 'OTHERS'
  let typeByPN = _typeByPN(partnumber)
  if (typeByPN) return typeByPN

  let typeByTypeI = _typeByTypeIAndTypeII(type1name, type2name)
  if (typeByTypeI) return typeByTypeI

  return type
}

/**
 *
 * P/N 開頭為「78」，「078」=> MLCC
 * P/N 開頭為「63」，「063」，「64」，「064」=> RES
 */
const _typeByPN = (part_number) => {
  if (part_number && part_number.match(/\./)) {
    let first_number = part_number.split('.')[0]
    if(first_number) {
      if (first_number.match(/^0*78$/)) {
        return 'MLCC'
      } else if (first_number.match(/^0*63$/)) {
        return 'RES'
      } else if (first_number.match(/^0*64$/)) {
        return 'RES'
      }
    }
  }

  return null
}

/**
 *
 * Type I 為「MLCC」且 Type II 為「SMD」=> MLCC
 * Type I 為「RES」且 Type II 為「RES-SMD」=> RES
 */
const _typeByTypeIAndTypeII = (type1, type2) => {
  if (type1 && type2) {
    if (type1.toUpperCase() == 'MLCC' && type2.toUpperCase() == 'SMD') {
      return 'MLCC'
    } else if (type1.toUpperCase() == 'RES' && type2.toUpperCase() == 'RES-SMD') {
      return 'RES'
    }
  }

  return null
}

module.exports = {
  originalByPreferredOrder,
  CommonPartByPreferredOrder,
  filterOBS,
  filterSuppyType,
  collatePrice,
  determineType,
}
