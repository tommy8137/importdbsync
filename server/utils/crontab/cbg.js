const { systemDB, cbgDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const spaModel = require('../../model/spa')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab cbg')
const _ = require('lodash')
const moment = require('moment-timezone')
const { supplyType: supplyTypeConfig } = require('../../../config')
const xrayModel = require('../../model/spa.js')
const vfilter = require('../../service/venderfilter')
class Cbg {
  static async syncEPUR_ITEMSPEC(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_ITEMSPEC----')
    let info = {
      typeName: 'EPUR_ITEMSPEC',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT ITEM,SPEC1,SPEC2,SPEC3,SPEC4,SPEC5,SPEC6,SPEC7,SPEC8,SPEC9,SPEC10,SPEC11,SPEC12,SPEC13,SPEC14,SPEC15,SPEC16,SPEC17,SPEC18,SPEC19,SPEC20,ACT_FLAG,INSDATE,SPEC21,SPEC22,SPEC23,SPEC24,SPEC25,SPEC26,SPEC27,SPEC28,SPEC29,SPEC30 FROM oas.EPUR_ITEMSPEC WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_ITEMSPEC length = ', result.length)
      logger.debug('start syncEPUR_ITEMSPEC at ::', start)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        logger.debug(result[i])
        await systemDB.Query('INSERT INTO wiprocurement.epur_itemspec (ITEM,SPEC1,SPEC2,SPEC3,SPEC4,SPEC5,SPEC6,SPEC7,SPEC8,SPEC9,SPEC10,SPEC11,SPEC12,SPEC13,SPEC14,SPEC15,SPEC16,SPEC17,SPEC18,SPEC19,SPEC20,ACT_FLAG,INSDATE,SPEC21,SPEC22,SPEC23,SPEC24,SPEC25,SPEC26,SPEC27,SPEC28,SPEC29,SPEC30, update_time, update_by)\
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,now(),$34) ON CONFLICT (ITEM) \
       DO UPDATE SET SPEC1=$2, SPEC2=$3, SPEC3=$4, SPEC4=$5, SPEC5=$6, SPEC6=$7, SPEC7=$8, SPEC8=$9, SPEC9=$10, SPEC10=$11, SPEC11=$12, SPEC12=$13, SPEC13=$14, SPEC14=$15, SPEC15=$16, SPEC16=$17, SPEC17=$18, SPEC18=$19, SPEC19=$20, SPEC20=$21, ACT_FLAG=$22, INSDATE=$23, SPEC21=$24, SPEC22=$25, SPEC23=$26, SPEC24=$27, SPEC25=$28, SPEC26=$29, SPEC27=$30, SPEC28=$31, SPEC29=$32, SPEC30=$33, update_time=now(), update_by=$34', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_ITEMSPEC', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_ITEMSPEC----')
      return result.length
    } catch (e) {
      logger.error('syncEPUR_ITEMSPEC:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_SOURCEDEF(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_SOURCEDEF----')
    let info = {
      typeName: 'EPUR_SOURCEDEF',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT SCODE, ENO, GROUPNAME, ACT_FLAG, INSDATE FROM oas.EPUR_SOURCERDEF WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_SOURCEDEF length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_SOURCERDEF (SCODE, ENO, GROUPNAME, ACT_FLAG, INSDATE, update_time, update_by) VALUES ($1, $2, $3, $4, $5,now(),$6) ON CONFLICT (SCODE)  DO UPDATE SET ENO = $2, GROUPNAME = $3, ACT_FLAG = $4, INSDATE = $5, update_time=now(), update_by=$6', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_SOURCEDEF', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_SOURCEDEF----')
      return result.length
    } catch (e) {
      logger.error('syncEPUR_SOURCEDEF:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_SOURCERPROXY(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_SOURCERPROXY----')
    let info = {
      typeName: 'EPUR_SOURCERPROXY',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT SCODE, ENO_PROXY , ACT_FLAG, INSDATE FROM oas.EPUR_SOURCERPROXY WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_SOURCERPROXY length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_SOURCERPROXY (SCODE, ENO_PROXY , ACT_FLAG, INSDATE, update_time, update_by) VALUES ($1, $2, $3, $4,now(), $5) ON CONFLICT (SCODE,ENO_PROXY)  DO UPDATE SET ACT_FLAG = $3, INSDATE = $4, update_time=now(), update_by=$5 ', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_SOURCERPROXY', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_SOURCERPROXY----')
      return result.length
    } catch (e) {
      logger.error('syncEPUR_SOURCERPROXY:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_VGROUP(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_VGROUP----')
    let info = {
      typeName: 'EPUR_VGROUP',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT VCODE, VGNAME, REF1, VBASE, VSNAME, ACT_FLAG, INSDATE FROM oas.EPUR_VGROUP WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_VGROUP length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_VGROUP (VCODE, VGNAME, REF1, VBASE, VSNAME, ACT_FLAG, INSDATE, update_time, update_by) VALUES ($1, $2, $3, $4, $5, $6, $7,now(),$8) ON CONFLICT (VCODE)  DO UPDATE SET VGNAME = $2, REF1 = $3, VBASE =$4 ,VSNAME = $5, ACT_FLAG =$6, INSDATE=$7, update_time=now(), update_by=$8', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_VGROUP', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_VGROUP----')
      return result.length
    } catch (e) {
      logger.error('EPUR_VGROUP::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_TYPE1(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_TYPE1----')
    let info = {
      typeName: 'EPUR_TYPE1',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT TYPE1ID, TYPE1NAME, LVALID, ACT_FLAG, INSDATE FROM oas.EPUR_TYPE1 WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('syncEPUR_TYPE1 length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_TYPE1 (TYPE1ID, TYPE1NAME, LVALID, ACT_FLAG, INSDATE, update_time, update_by) VALUES ($1, $2, $3, $4, $5,now(),$6) ON CONFLICT (TYPE1ID)  DO UPDATE SET TYPE1NAME = $2, LVALID = $3, ACT_FLAG =$4, INSDATE = $5, update_time=now(), update_by=$6', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_TYPE1', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_TYPE1----')
      return result.length
    } catch (e) {
      logger.error('EPUR_TYPE1::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_TYPE2(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_TYPE2----')
    let info = {
      typeName: 'EPUR_TYPE2',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT TYPE2ID, TYPE2NAME, LVALID, ACT_FLAG, INSDATE FROM oas.EPUR_TYPE2 WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('syncEPUR_TYPE2 length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_TYPE2 (TYPE2ID, TYPE2NAME, LVALID, ACT_FLAG, INSDATE, update_time, update_by ) VALUES ($1, $2, $3, $4, $5,now(),$6) ON CONFLICT (TYPE2ID)  DO UPDATE SET TYPE2NAME = $2, LVALID = $3, ACT_FLAG =$4, INSDATE = $5, update_time=now(), update_by= $6', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_TYPE2', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_TYPE2----')
      return result.length
    } catch (e) {
      logger.error('EPUR_TYPE2::::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncEPUR_SPEC_TITLE(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_SPEC_TITLE----')
    let info = {
      typeName: 'EPUR_SPEC_TITLE',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT TYPE1ID, TYPE2ID, LVALID, SPEC_T1, SPEC_T2, SPEC_T3, SPEC_T4, SPEC_T5, SPEC_T6, SPEC_T7, SPEC_T8, SPEC_T9, SPEC_T10, SPEC_T11, SPEC_T12, SPEC_T13, SPEC_T14, SPEC_T15, SPEC_T16, SPEC_T17, SPEC_T18, SPEC_T19, SPEC_T20, SPEC_T21, SPEC_T22, SPEC_T23, SPEC_T24, SPEC_T25, SPEC_T26, SPEC_T27, SPEC_T28, SPEC_T29, SPEC_T30, ACT_FLAG, INSDATE \
     FROM oas.EPUR_SPEC_TITLE WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\') AND TYPE1ID is not null and TYPE2ID is not null order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_SPEC_TITLE length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_SPEC_TITLE (TYPE1ID, TYPE2ID, LVALID, SPEC_T1, SPEC_T2, SPEC_T3, SPEC_T4, SPEC_T5, SPEC_T6, SPEC_T7, SPEC_T8, SPEC_T9, SPEC_T10, SPEC_T11, SPEC_T12, SPEC_T13, SPEC_T14, SPEC_T15, SPEC_T16, SPEC_T17, SPEC_T18, SPEC_T19, SPEC_T20, SPEC_T21, SPEC_T22, SPEC_T23, SPEC_T24, SPEC_T25, SPEC_T26, SPEC_T27, SPEC_T28, SPEC_T29, SPEC_T30, ACT_FLAG, INSDATE, update_time, update_by) \
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,now(),$36) ON CONFLICT (TYPE1ID,TYPE2ID) \
      DO UPDATE SET LVALID=$3, SPEC_T1=$4, SPEC_T2=$5, SPEC_T3=$6, SPEC_T4=$7, SPEC_T5=$8, SPEC_T6=$9, SPEC_T7=$10, SPEC_T8=$11, SPEC_T9=$12, SPEC_T10=$13, SPEC_T11=$14, SPEC_T12=$15, SPEC_T13=$16, SPEC_T14=$17, SPEC_T15=$18, SPEC_T16=$19, SPEC_T17=$20, SPEC_T18=$21, SPEC_T19=$22, SPEC_T20=$23, SPEC_T21=$24, SPEC_T22=$25, SPEC_T23=$26, SPEC_T24=$27, SPEC_T25=$28, SPEC_T26=$29, SPEC_T27=$30, SPEC_T28=$31, SPEC_T29=$32, SPEC_T30=$33, ACT_FLAG=$34, INSDATE=$35, update_time=now(), update_by=$36', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_SPEC_TITLE', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end sync EPUR_SPEC_TITLE----')
      return result.length
    } catch (e) {
      logger.error('EPUR_SPEC_TITLE:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }

  }
  static async syncEPUR_ITEMTYPE(startTime, endTime, updateBy) {
    logger.debug('----start sync EPUR_ITEMTYPE----')
    let info = {
      typeName: 'EPUR_ITEMTYPE',
      updateBy: updateBy,
    }
    let start = new Date()
    try {
      let result = await cbgDB.Query('SELECT TYPE1ID, TYPE2ID, ACT_FLAG, INSDATE, ITEM \
     FROM oas.ePur_ItemType WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('EPUR_ITEMTYPE length', result.length)
      logger.debug('start syncEPUR_ITEMTYPE at ::', start)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        logger.debug(result[i])
        await systemDB.Query('INSERT INTO wiprocurement.EPUR_ITEMTYPE (TYPE1ID, TYPE2ID, ACT_FLAG, INSDATE, ITEM, update_time, update_by) \
      VALUES ($1,$2,$3,$4,$5,now(),$6) ON CONFLICT (ITEM) \
      DO UPDATE SET TYPE1ID=$1, TYPE2ID=$2, ACT_FLAG=$3, INSDATE=$4, update_time=now(), update_by=$6', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'EPUR_ITEMTYPE', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----start end EPUR_ITEMTYPE----')
      return result.length
    } catch (e) {
      logger.error('EPUR_ITEMTYPE:::', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }
  static async getBackdoorInfo(pn, cal = 0) {
    let res = { memo: [] }
    let type12 = await spaModel.getTypeIandII(pn)
    type12 = _.omit(type12, 'partnumber')
    if (Object.keys(type12).length == 0) {
      res.memo.push('type1 & type2 找不到對應')
      return res
    }
    let spec = await spaModel.getSpecByPN(pn)
    let rules = await spaModel.getSpaRuleByPn(pn)

    let specRuleslist = onlyGetRule(rules[0])
    let specItems = await xrayModel.getSpecByPartNumber(pn, specRuleslist)
    let similarItem = await xrayModel.getItembySpec(Object.keys(supplyTypeConfig), type12[0]['type1'], type12[0]['type2'], specItems)
    let nowDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    let partnumbers = similarItem.map(e => e['partNumber'])
    let matnrs = await spaModel.getManufacturer(partnumbers)
    let spaPrice = await spaModel.getSPAPrice(pn)
    let supplyType = await spaModel.getSupplyTypeByPN(pn)
    let nonNullST = supplyType.filter(ele => ele.supply != null)
    if (nonNullST.length == 0) {
      res.memo.push('supply type為空，自己無法計算相似料號最低價')
    }
    let manufacturerList = await spaModel.getManufacturerByPNPrice(pn)
    let vendorFilter = await new vfilter()
    let a018p = await spaModel.getA018PricebyPN(pn)
    let purchasingOrg = await spaModel.getPurchasingOrgByPN(pn)

    res['type1 type2 from itemtype(cbg)'] = type12
    res['get supply type from marc(SAP)'] = supplyType
    res['accept supply type'] = supplyTypeConfig
    res['get manufacturer by eedm_pn_price'] = manufacturerList
    res['spec from itemspec(cbg)'] = spec
    res['spec rule from eebom_spa_rules(cbg)'] = rules
    res['get matnr from eina(SAP)'] = matnrs
    res['get similar item(SAP)'] = partnumbers
    res['get spa from eedm_spa_price'] = spaPrice
    res['get purchasingOrg and current price from eedm_bom_detail'] = purchasingOrg
    res['get a018 price by pn(a018)'] = a018p

    if (cal == 1) {
      let realtimespa = await spaModel.getMinPartnumber(partnumbers, vendorFilter)
      // res['calculate expire spa realtime'] = realtimespa
      res['expire best price'] = getBestPrice(realtimespa)
      let endDate
      let dateTo = moment(endDate).format('YYYY-MM-DD')
      let formatDate = moment(new Date(dateTo)).format('YYYY-MM-DD')
      let realtimespaWithOutEXP = _.filter(realtimespa, (m) => m.datbi >= formatDate)
      res['best price'] = getBestPrice(realtimespaWithOutEXP)
    }

    return res
  }
}

const onlyGetRule = (data) => {
  let specRules = _.omit(data, 'partnumber', 'type1', 'type2')
  let spec = Object.keys(specRules).filter(k => {
    if (data[k] == 'Y') return k
  })
  return spec
}

function fixedPoint(value, n) {
  return Math.round(value * Math.pow(10, n)) / Math.pow(10, n)
}
const getBestPrice = (materialList) => {
  let minList = _.chain(materialList)
    .sortBy(m => m.unitPrice)
    .uniq()
    .map(v => {
      v.unitPrice = fixedPoint((v.unitPrice), 5)
      return v
    })
    .groupBy(m => m.unitPrice)
    .value()


  let minPrice = _.min(Object.keys(minList))

  // order by Wistron partnumber 由小至大
  let lowerPartnumber = _.chain(minList[minPrice])
    .orderBy('bmatn', ['asc'])
    .groupBy(m => m.partNumber)
    .map((v, k) => {

      return {
        spa_price: minPrice,
        spa_partnumber: k,
        matnr: _.map(v, 'matnr'),
        manufacturer: JSON.stringify(_.chain(v)
          .map('manufacturer')
          .uniq()
          .slice(0, 3)
          .value()),
        expiry_date: _.minBy(v, ['datbi']).datbi,
      }
    })
    .slice(0, 1)
    .value()

  return lowerPartnumber[0]
}


module.exports = Cbg
