const _ = require('lodash')
const moment = require('moment')
const commonLogical = require('./logical.js')
const { fixedPoint } = require('./math.js')

/**
 * 轉換匯率 into USD, 取得原始價格&原始幣別
 *
 * @param {array} materialList 料號資訊 ex: [{
      "partNumber": "5260031400G$AA",
      "matnr": "MPN02927184",
      "datab": "2019-02-10T16:00:00.000Z",
      "unitPrice": 0.00001,
      "unit": "1000",
      "currency": "RMB",
      "manufacturer": "VISHAY",
      "knumh": "0173215116"
  }]
 * @param {array} exchangeRate 匯率
 * ex: exchangeRate = [ { date: '20190301',
    fcurr: 'RMB',
    exchangeRate: '0.147' } ]
 * @returns {array} 轉換完的料號資訊
 */

const calculatePrice = (items, exchangeRate) => {

  items.map((m) => {
    m['originalUnitPrice'] = m.unitPrice
    m['originalCurrency'] = m.currency

    if (m.currency != 'USD') {
      let rate
      let fcurr = exchangeRate.find(r => r.fcurr == m.currency)
      if (!fcurr) rate = 0
      else rate = fcurr.exchangeRate

      // eslint-disable-next-line operator-assignment
      m.unitPrice *= rate
      m.currency = 'USD'
    }
  })

  return items
}

const getAltMinPrice = async (priceList, partnumber = null) => {
  let lowerRes = null
  if (partnumber) {
    priceList = filterMainPartNumber(priceList, partnumber)
  }

  if (priceList.length > 0) {
    let collatePriceList = commonLogical.collatePrice(priceList)
    let minPrice = _.min(Object.keys(collatePriceList))
    let listCollatedByCMP = await commonLogical.CommonPartByPreferredOrder(collatePriceList[minPrice])

    // order by Wistron partnumber 由小至大
    // let lowerPartnumber = _.chain(listCollatedByCMP)
    //   .orderBy('partNumber', ['asc'])
    //   .groupBy(m => m.partNumber)
    //   .map((v, k) => {
    //     let original = commonLogical.originalByPreferredOrder(v)
    //
    //     // let original = _.chain(v).sortBy(c => c.originalCurrency).value()
    //     return {
    //       alt_num: k,
    //       lowest_price: fixedPoint(minPrice, 5),
    //       origin_lowest_price: fixedPoint(original.originalUnitPrice, 5),
    //       currency: 'USD',
    //       origin_currency: original.originalCurrency,
    //       manufacturer: original.manufacturer,
    //       valid_from: original.valid_from,
    //     }
    //   })
    //   .filter(x => !!x)
    //   // .slice(0, 1)
    //   .value()

    lowerRes = getAltMinPriceGroupBy(listCollatedByCMP)
  }

  return lowerRes ? lowerRes : null
}

const filterMainPartNumber = (priceList, partnumber) => {
  return _.filter(priceList, (price) => price.partNumber != partnumber)
}

const getAltMinPriceGroupBy = (minPriceList) => {
  // order by Wistron partnumber 由小至大
  let lowerPartnumber = _.chain(minPriceList)
    .orderBy('partNumber', ['asc'])
    .groupBy(m => m.partNumber)
    .map((v, k) => {
      let original = commonLogical.originalByPreferredOrder(v)

      // let original = _.chain(v).sortBy(c => c.originalCurrency).value()
      return {
        alt_num: k,
        lowest_price: fixedPoint(original.unitPrice, 5),
        origin_lowest_price: fixedPoint(original.originalUnitPrice, 5),
        currency: 'USD',
        origin_currency: original.originalCurrency,
        manufacturer: original.manufacturer,
        valid_from: original.valid_from,
        vendor_pn: original.vendor_pn,
      }
    })
    // .filter(x => !!x)
    .slice(0, 1)
    .value()

  return lowerPartnumber && lowerPartnumber[0] ? lowerPartnumber[0] : null
}

const getSpaMinPrice = async (materialList) => {
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
        // original_manufacturer: original.manufacturer,
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

module.exports = {
  calculatePrice,
  getAltMinPrice,
  getSpaMinPrice,
}
