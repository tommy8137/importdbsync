let RedisPubSub = require('node-redis-pubsub')
let redisPool = require('../utils/redis/index')
const _ = require('lodash')
const https = require('https')
const axios = require('axios')
const log4js = require('../utils/logger/logger')

const { redisConfig, eproConfig, eproComputerConfig } = require('../../config.js')

const emdmService = require('./emdm.js')
const emdmModel = require('../model/emdm')


let redisClient = redisPool.init(redisConfig)
const logger = log4js.getLogger('[emdmPartComputer]')


async function verifyPorjectInfo (processPayload) {
  let verifyError = []
  let { productTypeId, site } = processPayload
  if (_.isNil(productTypeId)) {
    verifyError.push('expect input productTypeId.')
  }
  if (_.isNil(site)) {
    verifyError.push('expect input site.')
  } else {
    let _siteName = await emdmService.getRelationVal('SITE', site)
    processPayload.siteName = _siteName
  }
  return verifyError
}

async function calculateResult ( prepareData, productTypeId, site, hasOlderProject) {
  logger.info('productTypeId:', productTypeId, 'site:', site, 'hasOlderProject:', hasOlderProject)
  let productTypeName =  await emdmModel.getProductTypeById(productTypeId)
  const partlistPayload = {
    emdmBomInfo: prepareData,
    partItemInfo: {
      type1: prepareData.partcategory1,
      type2: prepareData.partcategory2,
      productType: productTypeName, // memo NB, DT
      site: site,
    },
  }

  let url = `https://${eproConfig.eproIp}:${eproConfig.eproPort}/utils/calculatePrice`
  const agent = {
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  }
  let bomInfo = {
    'productType':productTypeName,
    productTypeId,
    hasOlderProject,
    site,
  }
  // 更新資料
  const res = await axios.post(url, {
    bomInfo,
    'partlistPayload':[
      partlistPayload,
    ],
  }, agent)

  return res.data
}

function checkLastPriceCategory(type1, type2){
  let ctgyConfig = eproComputerConfig.lastPriceAvaliablePartCategory || {}
  let result = false
  type1 = type1.trim().toUpperCase()
  type2 = type2.trim().toUpperCase()
  if ( ctgyConfig.hasOwnProperty(type1) ) {
    let type2Config = ctgyConfig[type1]
    result = type2Config.find((type) => type === type2) !== null
  }
  return result
}

class EmdmPartComputer {
  static async processFn(workData) {
    let { route, taskCreateTime, identifyPayload, processPayload } = workData
    let verifyErrRes = await verifyPorjectInfo(processPayload)
    if (verifyErrRes.length) {
      throw new Error(`verify project info with Errors:${verifyErrRes.toString()} route:${route}, taskCreateTime:${taskCreateTime}, identifyPayload:${JSON.stringify(identifyPayload, 0, 2)}, processPayload:${JSON.stringify(processPayload, 0, 2)}`)
    }
    if (!processPayload.hasOwnProperty('cmfForm')) {
      processPayload.cmfForm = null
    }
    let prepareData = await emdmService.prepareCalculatePriceData(processPayload)
    let hasOlderProject = -1
    logger.debug('projectCode:', processPayload.projectCode)
    if (processPayload.hasOwnProperty('projectCode')) {
      hasOlderProject = await emdmModel.getOlderProjectId(processPayload.projectCode)
    }
    let result = await calculateResult(prepareData, processPayload.productTypeId, processPayload.siteName, hasOlderProject)
    return result
  }
  static async resultFn(workData, result, isDebug = false) {
    let timeStamp = new Date().getTime()
    let priceObj = {
      'cleanSheetCost': null,
      'lastPrice': {
        'cost': null,
        'partCategory1Id': '',
        'partCategory1':'',
        'partCategory2Id':'',
        'partCategory2':'',
        'failReason': '',
      },
    }
    if (Array.isArray(result) && result.length) {
      if (_.has(result, '0.priceResult.totalPrices')) {
        priceObj.cleanSheetCost = _.get(result, '0.priceResult.totalPrices')
      }
      if (result[0].hasOwnProperty('last_price')) {
        let _lastPrice = JSON.parse(result[0].last_price)
        priceObj.lastPrice.failReason = _lastPrice.failReason ? _lastPrice.failReason : ''
        let getRes = await emdmService.getPartNumberCategory(result[0])
        logger.debug('partNumberType1Type2:', getRes)
        if (getRes) {
          priceObj.lastPrice.partCategory1Id = getRes.part_category_1_uuid ? getRes.part_category_1_uuid : ''
          priceObj.lastPrice.partCategory2Id = getRes.part_category_2_uuid ? getRes.part_category_2_uuid : ''

          priceObj.lastPrice.partCategory1 = getRes.category_1_name ? getRes.category_1_name : ''
          priceObj.lastPrice.partCategory2 = getRes.category_2_name ? getRes.category_2_name : ''
          // console.log(_lastPrice)
          if ( checkLastPriceCategory(getRes.category_1_name, getRes.category_2_name) ) {
            if (
              !_.isNil(_lastPrice.unitPrice) && _lastPrice.unitPrice !== '-' &&
              !_.isNil(_lastPrice.isValidPrice) && _lastPrice.isValidPrice
            ) {
              priceObj.lastPrice.cost = _lastPrice.unitPrice
            }
          } else {
            priceObj.lastPrice.failReason += 'Unexpect category.'
          }
        }
      }
    }
    let resultPayload = JSON.stringify({
      'route':workData.route,
      'taskCreateTime': workData.taskCreateTime,
      'resultCreateTime':timeStamp,
      'identifyPayload': workData.identifyPayload,
      'resultPayload': priceObj,
    })
    logger.debug('resultPayload', resultPayload)
    if (isDebug) {
      return resultPayload
    }
    await redisClient.request('lpush', 'taskQueue:result', resultPayload)
    let pubsubClient = new RedisPubSub(redisConfig)
    pubsubClient.emit('taskQueue:result', timeStamp)
    pubsubClient.quit()
  }
  static async debugPartComputer(req) {
    let processRes = await EmdmPartComputer.processFn(req)
    let resultRes = await EmdmPartComputer.resultFn(req, processRes, true)
    return {
      'priceResult': processRes[0].priceResult,
      'resultRes' : JSON.parse(resultRes, 0, 2),
    }
  }
}

module.exports = EmdmPartComputer

/* let test = async function() {
  let testDataList = [
    '{"route":"partlist.computer","taskCreateTime":1596705665805,"identifyPayload":{"objectId":"5f2b6c6c8a6c071191d0396f"},"processPayload":{"ppId":"ffe0ccd4-1a57-4ad3-b751-109fb9b231f3","level":2,"partLong":1.0000,"partWidth":2.0000,"diameter":4.0000,"partLong2":4.0000,"partWidth2":3.0000,"thickness":3.0000,"partCategory1Id":"69430fee-55d8-11e9-b564-0242ac110002","partCategory2Id":"69435864-55d8-11e9-b564-0242ac110002","wistronPartName":"X751LB-1A 17.3 FHD/EWV|(LED)","wpn":"440.0BW0T.0051","metric":5.0000,"mfrType":"ODM","projectPartStatus":"Initial","allPartsOrder":1,"emdmId":"emdm_378c3d44-f1ab-456d-9d7d-f10b0f9147f4","site":2,"productTypeId":1}}',
    '{"route":"partlist.computer","taskCreateTime":1596705669089,"identifyPayload":{"objectId":"5f2b6c6c8a6c071191d03978"},"processPayload":{"ppId":"ff51d98d-926f-4e85-952c-e7f09b432b64","level":2,"partLong":2.0000,"partWidth":2.0000,"diameter":1.0000,"partLong2":0.0000,"partWidth2":0.0000,"thickness":1.3300,"partCategory1Id":"6942ff04-55d8-11e9-b564-0242ac110002","partCategory2Id":"694344e6-55d8-11e9-b564-0242ac110002","materialSpecId":"158c6072-f708-11e9-902e-0242ac110002","materialId":"158d18be-f708-11e9-902e-0242ac110002","wistronPartName":"SPS-LCD PANEL 14 FHD AG SVA NWBZ HEDWIG","wpn":"L45135-001","metric":1.0000,"mfrType":"ODM","projectPartStatus":"Initial","allPartsOrder":1,"drawingFileKey":"project/emdm_e3880102-0672-43ee-a10f-9fa5f78eef14/part/e2dbf649-0203-4514-a9b8-16043f70d583.jpg","cmfForm":"{\\"cmfPEmbedNailCount\\":44,\\"cmfPEmbedNailCheckBox\\":true,\\"cmfPEmbedNailAuto\\":\\"163097f0-f708-11e9-902e-0242ac110002\\",\\"cmfProcessListPolishingAutoArea\\":20,\\"cmfProcessListPolishingArtificialArea\\":56}","totalProjectQty":0,"plasticMaterialLossRateId":"15aed936-f708-11e9-902e-0242ac110002","materialSpecDoubleInjectionId":"158cf438-f708-11e9-902e-0242ac110002","materialDoubleInjectionId":"15912abc-f708-11e9-902e-0242ac110002","emdmId":"emdm_e3880102-0672-43ee-a10f-9fa5f78eef14","materialRemark":"哈囉-2","site":2,"productTypeId":1}}',
  ]
  for(let testData of testDataList) {
    let workData = JSON.parse(testData)
    let startTime = process.hrtime()
    let res = await EmdmPartComputer.processFn(workData)
    await EmdmPartComputer.resultFn(workData, res)
    let spendTime = process.hrtime(startTime)
    console.log(JSON.stringify(res))
    console.log(`task spend ${spendTime[0]} sec`)
  }
}
test() */