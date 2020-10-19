const _ = require('lodash')
let squel = require('squel').useFlavour('postgres')
const moment = require('moment')

const { systemDB, plmDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
// const mail = require('../../utils/mail/mail.js')
// const msg = require('../../utils/mail/message.js')
// const log4js = require('../logger/logger')
const { DecimalGetter } = require('../../utils/decimalConfig/index.js')

// const logger = log4js.getLogger('crontab plm')
const meFloatPoint = new DecimalGetter('MEBom')

const formatFloat = function (num, pos) {
  //check Number
  num = Number(num)
  if (isNaN(num)) {
    num = 0
  }
  let size = Math.pow(10, pos)
  return Math.round(num * size) / size
}

class MeBom {
  constructor() {
    this.syncPartnumberPrice = this.syncPartnumberPrice.bind(this)
    this.getPartNumberPrice = this.getPartNumberPrice.bind(this)
  }

  static async syncPartnumberPrice() {
    let bomItemInfos = await this.getBomItemInfo()
    let partNumbers = await this.getBomItemPartNumberInfo(bomItemInfos)
    let res = await this.getPartNumberPrice(partNumbers, bomItemInfos)
    // distinct part number
    res = _.uniqBy(res, 'part_number')
    await Promise.all(
      _.map(res, async (v) =>{
        await this.updateBomItemLastPrice(v)
      })
    )
  }

  static async getBomItemInfo(){
    let sql = squel.select()
      .field('id')
      .field('part_number')
      .field('last_price')
      .from('wiprocurement.bom_item')
    let meBomItemInfos = await systemDB.Query(sql.toParam())
    return meBomItemInfos.rows
  }

  static async getBomItemPartNumberInfo(src) {
    let partNumber = []
    if (src) {
      let filterRes = _.filter(src, (v) => {
        if (_.isEmpty(v.last_price)) {
          return v
        } else {
          if (v.last_price.unitPrice === null || v.last_price.validDate === null) {
            return v
          }
        }
      })
      _.map(filterRes, (v) => {
        if (v.part_number) {
          partNumber.push(v.part_number.trim())
        }
      })
    }
    return partNumber
  }

  static async getPartNumberPrice(partNumber, bomItemInfos) {
    let minPrice = []
    let res = []
    if (partNumber && partNumber.length > 0) {
      let sql = squel.select()
        .field('b.matnr', 'matnr')
        .field(squel.str(`to_char(b.datab,'${'YYYY-MM-DD'}')`), 'datab')
        .field(squel.str(`to_char(b.datbi,'${'YYYY-MM-DD'}')`), 'datbi')
        .field('cast(b.KBETR as numeric)', 'price')
        .field('b.kpein', 'unit')
        .field('(cast(b.KBETR as numeric) / b.kpein)', 'unitprice')
        .field('b.konwa', 'currency')
        .field('b.knumh', 'knumh')
        .field('a.bmatn', 'part_number')
        .from(squel.select().from('wiprocurement.eina').where('bmatn in ?', partNumber)
          .where(squel.str(`(MFRNR is not null or MFRNR <> '${''}') AND (LOEKZ is null or LOEKZ = '${''}')`)), 'a')
        .join(squel.select().from('wiprocurement.a018_konp').where('datbi >= ?', moment().format('YYYY-MM-DD'))
          .where(squel.str(`LOEVM_KO is null or LOEVM_KO = '${''}'`)), 'b', 'a.matnr=b.matnr')
        .order('knumh', false)
        .order('matnr')
        .order('datab', false)
      const result = await systemDB.Query(sql.toParam())
      let queryRes = result.rows
      if (queryRes) {
        let rate = []
        if (queryRes && queryRes.length > 0) {
          let currencyList = _.chain(queryRes).map('currency').uniq().value()
          let exchangeCurrency = _.filter(currencyList, c => c != 'USD')
          if (exchangeCurrency && exchangeCurrency.length > 0) {
            rate = await this.getExchangeRate(moment().format('YYYYMMDD'), exchangeCurrency)
          }

          queryRes.map((m) => {
            if (m.currency != 'USD') {
              let exchangeRate
              let fcurr = rate.find(r => r.fcurr == m.currency)
              if (!fcurr) exchangeRate = 0
              else exchangeRate = fcurr.exchangeRate
              m.datab = moment(m.datab).format('YYYY-MM-DD')
              m.datbi = moment(m.datbi).format('YYYY-MM-DD')
              m.currency = 'USD'
              m.exchangeRate = formatFloat(exchangeRate, meFloatPoint.get('exchangeRate'))
              m.unitPrice = formatFloat(formatFloat(exchangeRate, meFloatPoint.get('exchangeRate')) * formatFloat(m.unitprice, meFloatPoint.get('lastPrice')), meFloatPoint.get('lastPrice'))
            } else {
              m.unitPrice = formatFloat(m.unitprice, meFloatPoint.get('lastPrice'))
            }
          })

          let groupRes = _.groupBy(queryRes, 'part_number')
          _.forEach(groupRes, (v, key) => {
            minPrice.push(_.maxBy(groupRes[key], function (o) { return o.knumh }))
          })

          if (minPrice && minPrice.length > 0) {
            _.forEach(bomItemInfos, (v) => {
              let queryRes = _.find(minPrice, (dv) => { return dv.part_number == v.part_number })
              if (queryRes) {
                let obj = {}
                obj.unitPrice = parseFloat(queryRes.unitPrice).toString()
                obj.validDate = queryRes.datab
                obj.currency = queryRes.currency
                v.last_price = JSON.stringify(obj)
                res.push(v)
              }
            })
          }
        }
      }
    }
    return res
  }

  static async getExchangeRate(date, currency) {
    let sql = squel
      .select()
      .distinct('fcurr')
      .field('GDATU', 'date')
      .field('fcurr')
      .field('(UKURS*TFACT/FFACT)', '"exchangeRate"')
      .from('wiprocurement.exchange_rate')
      .where('GDATU <= ? AND fcurr in ? AND tcurr = \'USD\'', date, currency)
      .order('fcurr')
      .order('GDATU', false)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  }

  static async updateBomItemLastPrice(src){
    let sql = squel.update().table('wiprocurement.bom_item')
    if (src.last_price) sql.set('last_price', src.last_price)
    sql.where('part_number = ?', src.part_number)
    sql.returning('*')
    await systemDB.Query(sql.toParam())
  }
}

module.exports = MeBom