/* eslint-disable no-magic-numbers */
const _ = require('lodash')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('Emdm')
const tsystemDB = require('../helpers/database/tPostgres')
const { asyncForEach } = require('../utils/common/utils')
const emdmModel = require('../model/emdm')
const uuidv4 = require('uuid/v4')
const nodeCache = require('node-cache')
const moment = require('moment')
const { eproConfig } = require('../../config.js')
const https = require('https')
const axios = require('axios')
const util = require('util')

const RELATIONTYPECACHEKEY = 'RELATIONTYPE'
const STAGECACHEKEY = 'STAGE'
const SITECACHEKEY = 'SITE'
const PARTLISTFORMATCACHEKEY = 'PARTLISTFORMAT'
const MATERIALSPECANDMATERIALCACHEKEY = 'MATERIALSPECANDMATERIAL'
const CREATEPROJECTERROR = 'CREATEBMEBOMPROJECTERROR'
const CREATEDESIGNEEERROR = 'CREATEDESIGNEEERROR'
const CREATESTAGEVERSIONERROR = 'CREATESTAGEVERSIONERROR'
const MISSINGUNIQUERAMETERERROR = 'MISSINGUNIQUERAMETERERROR'
const MISSINGSTAGEORSITEPARAMATER = 'MISSINGSTAGEORSITEPARAMATER'
const NO_NEED_PARTLIST_MATERIAL_AND_MATERIAL_SPEC_ID_LIST = 'NO_NEED_PARTLIST_MATERIAL_AND_MATERIAL_SPEC_ID_LIST'
const cache = new nodeCache({ stdTTL: 300, checkperiod: 30 })
// const ROOTPARENTLEVEL = 2
const NO_NEED_PARTLIST_ODM_OEM_LIST = {
  'OEM':true,
  'TBD':true,
}
const SPLIT_INSERT_SIZE = 50
const SKU_MAX = 5

const getRelationData = async () => {
  let relationType = await emdmModel.getRelationType()
  let stage = await emdmModel.getStage()
  let siteData = await emdmModel.getSite()
  let partlistFormat = await emdmModel.getPartListFormat()
  let materialSpecAndMaterial = await emdmModel.getMaterialSpecAndMaterial()
  let materialSpecAndMaterialNoNeedPartListIdList = await emdmModel.getMaterialSpecAndMaterialNoNeedPartListIdList()
  let res = {}
  if (relationType) {
    res.relationType = relationType
  }
  if (stage) {
    res.stage = stage
  }
  if (siteData) {
    res.site = siteData
  }
  if (partlistFormat) {
    res.partlistFormat = partlistFormat
  }
  if (materialSpecAndMaterial) {
    res.materialSpecAndMaterial = materialSpecAndMaterial
  }
  if(materialSpecAndMaterialNoNeedPartListIdList){
    res.materialSpecAndMaterialNoNeedPartListIdList = materialSpecAndMaterialNoNeedPartListIdList
  }
  return res
}

const getMeBomCacheValue = async (key) => {
  if (cache.has(key)) {
    return cache.get(key)
  } else {
    let data = await getRelationData()
    if (!_.isEmpty(data)) {
      let success = cache.mset([
        { key: RELATIONTYPECACHEKEY, val: data.relationType },
        { key: STAGECACHEKEY, val: data.stage },
        { key: SITECACHEKEY, val: data.site },
        { key: PARTLISTFORMATCACHEKEY, val: data.partlistFormat },
        { key: MATERIALSPECANDMATERIALCACHEKEY, val: data.materialSpecAndMaterial },
        { key: NO_NEED_PARTLIST_MATERIAL_AND_MATERIAL_SPEC_ID_LIST, val: data.materialSpecAndMaterialNoNeedPartListIdList },
      ])

      if (success) {
        return cache.get(key)
      }
      return data
    } else {
      return null
    }
  }
}

class EMDM {
  constructor() {
    this.syncMEBOM = this.syncMEBOM.bind(this)
    this.prepareBomItemData = this.prepareBomItemData.bind(this)
    this.getMaterialLastPrice = this.getMaterialLastPrice.bind(this)
    this.prepareCalculatePriceData = this.prepareCalculatePriceData.bind(this)
  }
  static async syncMEBOM(req = null) {
    let result = {
      'syncCount': 0,
      'bomIdList': [],
    }
    try {
      let lastApproveTime = null
      // req 不為null 時，代表為手動，此時無須取得最大流水號
      // 取得已記錄最大流水號
      if(!req){
        lastApproveTime = await emdmModel.getLastReceiveRecord()
      }
      // 從 emdm view -> view_project_part_checkin_history 取得資訊

      let emdmListRes = await emdmModel.getMDMList(req, lastApproveTime ? moment(lastApproveTime).format('YYYYMMDD HH:mm:ss') : null)
      let emdmList = []
      emdmListRes.forEach((item) => {
        emdmList.push(item.ppch_id)
      })
      // let medmRes = await emdmModel.getMDMData()
      logger.info(`---- emdm record ppch_id:${emdmList}`)
      let receiveEmdmArr = []
      let failReceiveEmdmArr = []
      let emdmListLength = emdmList.length
      // 依序建立bom project, item
      if (emdmListLength > 0) {
        let client = null
        for (let i = 0; i < emdmListLength; i++) {
          let emdmProjectId = emdmList[i]
          let emdmProject = await emdmModel.getMDMData(emdmProjectId)
          let failObj = {}
          logger.info(`---- emdm record ppch_id:${emdmProjectId} project_code:${emdmProject.project_code} version:${emdmProject.version} start syncing.`)
          try {
            let receiveEmdmObj = {}
            if (!emdmProject.project_code || !emdmProject.version ) {
              failObj.emdm_ppch_id = emdmProject.ppch_id
              failObj.emdm_project_code = emdmProject.project_code
              failObj.emdm_version = emdmProject.version
              failObj.error_reaseon = MISSINGUNIQUERAMETERERROR
              failReceiveEmdmArr.push(failObj)
              continue
            }
            if (!emdmProject.site || !emdmProject.stage) {
              failObj.emdm_ppch_id = emdmProject.ppch_id
              failObj.emdm_project_code = emdmProject.project_code
              failObj.emdm_version = emdmProject.version
              failObj.error_reaseon = MISSINGSTAGEORSITEPARAMATER
              failReceiveEmdmArr.push(failObj)
              continue
            }
            let checkRes = await this.checkProjectExist(emdmProject.project_code, emdmProject.version)
            let olderProjectId = await emdmModel.getOlderProjectId(emdmProject.project_code)
            let projectRes = null
            // step 1 create or update bom project
            if (checkRes) {
              // update me bom project info
              // projectRes = await this.updateMeBomProjectData(client, dv)
              logger.info(`---- emdm record ppch_id:${emdmProjectId} project_code:${emdmProject.project_code} version:${emdmProject.version} already receive`)
              continue
            } else {
              client = await new tsystemDB()
              // insert
              projectRes = await this.insertMeBomProjectData(client, emdmProject, olderProjectId)
            }

            const { id: bomId, product_type: productType, site } = projectRes
            result.bomIdList.push(bomId)
            result.syncCount++

            if (bomId) {
              // step 2 create designee
              let ownerId = await this.insertMeBomDesigneeData(client, bomId, emdmProject.approve_user_id)
              // step 3 create version
              let versionId = await this.insertVersionData(client, bomId, emdmProject.stage)
              // step 4 create bom item and part list
              let prepareData = await this.prepareCalculatePriceDataMulti(this.prepareBomItemData(emdmProject.eprocurement_json_content))
              if (prepareData.length > SPLIT_INSERT_SIZE) {// 1001 > 50
                logger.info(`---- emdm record ppch_id:${emdmProjectId} items count:${prepareData.length} bigger then ${SPLIT_INSERT_SIZE} split in to smaller group.`)
                let count = Math.ceil(prepareData.length / SPLIT_INSERT_SIZE) // 1001 / 50 ~= 21
                for (let j = 0; j < count; j++) {
                  let start = SPLIT_INSERT_SIZE * j// 50 * j, 0, 50, 100... 1000
                  let stop = Math.min(SPLIT_INSERT_SIZE * (j + 1), prepareData.length)// 50, 100, 150... 1001
                  let tmpPrepareData = prepareData.slice(start, stop)
                  logger.info(`---- emdm record ppch_id:${emdmProjectId} items from ${start} to ${stop} calculate part list.`)
                  await this.calculateAndInsertResult(client, tmpPrepareData, ownerId, bomId, versionId, emdmProject.approve_time, productType, site, olderProjectId, prepareData)
                }
              } else {
                logger.info(`---- emdm record ppch_id:${emdmProjectId} items count:${prepareData.length} calculate part list.`)
                await this.calculateAndInsertResult(client, prepareData, ownerId, bomId, versionId, emdmProject.approve_time, productType, site, olderProjectId)
              }
              await client.commit()
              receiveEmdmObj.epro_me_project_id = bomId
              receiveEmdmObj.emdm_ppch_id = emdmProject.ppch_id
              receiveEmdmObj.approve_time = moment(emdmProject.approve_time).format('YYYYMMDD HH:mm:ss')
              receiveEmdmArr.push(receiveEmdmObj)
              logger.info(`---- emdm record ppch_id:${emdmProjectId} project_code:${emdmProject.project_code} version:${emdmProject.version} done syncing.`)
            }else{
              await client.rollback()
            }
          } catch (err) {
            failObj.emdm_ppch_id = emdmProject.ppch_id
            failObj.emdm_project_code = emdmProject.project_code
            failObj.emdm_version = emdmProject.version
            let errMsg = err
            if(_.isObject(err)){
              errMsg = util.inspect(err)
            }
            failObj.error_reaseon = errMsg.substr(0, 1990)
            failReceiveEmdmArr.push(failObj)
            if (client) {
              await client.rollback()
            }
            logger.error('sync failed in emdm ppchId', emdmProject.ppch_id, '--------reason----------', err)
          }
        }

        // step 6 insert record fail and successful
        if(receiveEmdmArr.length > 0){
          await emdmModel.insertReceiveRecord(receiveEmdmArr)
        }
        if(failReceiveEmdmArr.length > 0){
          await emdmModel.insertReceiveFailRecord(failReceiveEmdmArr)
          throw new Error(JSON.stringify(failReceiveEmdmArr))
        }
        receiveEmdmArr = []
        failReceiveEmdmArr = []
        // return emdmListLength
      } else {
        logger.info(`---- emdm no record ----${new Date()}`)
        // return 0
      }
    } catch (error) {
      logger.error('sync syncMEBOM failed', JSON.stringify(error, null, 2))
      throw new Error(error.message ? util.inspect(error.message) : util.inspect(error))
    }
    return result
  }

  static async calculateAndInsertResult (client, prepareData, ownerId, bomId, versionId, approve_time, productType, site, hasOlderProject, fullPrepareData = null) {
    let productTypeId =  await emdmModel.getProductTypeByName(productType)
    const partlistPayload = prepareData.map((item) => ({
      emdmBomInfo: item,
      partItemInfo: {
        type1: item.partcategory1,
        type2: item.partcategory2,
        productType: productType, // memo NB, DT
        site: site,
      },
    }))

    let url = `https://${eproConfig.eproIp}:${eproConfig.eproPort}/utils/calculatePrice`
    const agent = {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
    // 更新資料
    const res = await axios.post(url, {
      bomInfo:{
        productType,
        productTypeId,
        hasOlderProject,
        site,
      },
      partlistPayload,
    }, agent)

    prepareData = res.data
    let insertData = await this.setBomItemValue(prepareData, ownerId, bomId, versionId, approve_time, productType, fullPrepareData)
    // get last price
    // await this.getMaterialLastPrice(insertData.bomItems) // 由epro calculat 一併計算
    // insert bom item
    await this.insertMeBomItemData(client, insertData)
    await this.insertMeBomPartData(client, insertData)
    // step 5 call wi-procurement api to compute cleansheet price
  }

  static async insertMeBomProjectData(client, data, hasOlderProject) {
    if (data) {
      let oldBomProjectInfo = await emdmModel.getBomProjectInfoById(hasOlderProject)
      data.sourcer_permission_id = _.isNull(oldBomProjectInfo) ? null : oldBomProjectInfo.sourcer_permission_id
      let bomProjectId = await emdmModel.insertMeBomProject(client, data)
      await emdmModel.insertBomProjectParams(client, bomProjectId.id, bomProjectId.product_type, false, hasOlderProject)// 建立專案參數
      return bomProjectId
    }
    throw CREATEPROJECTERROR
  }

  static async updateMeBomProjectData(client, data) {
    if (data) {
      let bomProjectId = await emdmModel.updateMeBomProject(client, data)
      return bomProjectId
    }
    return null
  }

  static async insertMeBomDesigneeData(client, bomId, approverUserId) {
    if (bomId && approverUserId) {
      let bomDesigneeId = await emdmModel.inertMeBomDesignee(client, bomId, approverUserId)
      return bomDesigneeId
    }
    throw CREATEDESIGNEEERROR
  }

  static async insertVersionData(client, bomId, stage) {
    if (bomId && stage) {
      let data = { bomId: bomId, stage: stage }
      let bomVersionId = await emdmModel.insertMeBomVersion(client, data)
      return bomVersionId
    }
    throw CREATESTAGEVERSIONERROR
  }

  static async insertMeBomItemData(client, data) {
    if (data.bomItems && data.bomItems.length > 0) {
      await emdmModel.insertMeBomItem(client, data.bomItems)
      await emdmModel.insertEmdmExtra(client, data.emdmExtras)
    }
  }

  static async insertMeBomPartData(client, data) {
    if (data.bomPartList && data.bomPartList.length > 0) {
      await emdmModel.insertMeBomPartlist(client, data.bomPartList)
    }
    return null
  }

  static async checkProjectExist(projectCode, version) {
    return await emdmModel.checkProjectIsExist(projectCode, version)
  }
  static async prepareCalculatePriceDataMulti(src) {
    const result = []
    for (let emdmBomItem of src) {
      let priceDataRes = await this.prepareCalculatePriceData(emdmBomItem)
      result.push(priceDataRes)
    }
    return result
  }
  static async prepareCalculatePriceData(emdmBomItem) {
    const materialSpecAndMaterialName = await emdmModel.getMaterialSpecAndMaterialName({
      materialSpecId: emdmBomItem.materialSpecId,
      materialId: emdmBomItem.materialId,
    })
    const parts1AndParts2Name = await emdmModel.getParts1AndParts2Name({
      partCategory1Id: emdmBomItem.partCategory1Id,
      partCategory2Id: emdmBomItem.partCategory2Id,
    })
    
    return {
      ...emdmBomItem,
      ...parts1AndParts2Name,
      ...materialSpecAndMaterialName,
      cmfForm: JSON.parse(emdmBomItem.cmfForm),
    }
  }

  static async getPartNumberCategory(emdmBomItem){
    let partNumber = emdmBomItem.commonPart ? emdmBomItem.commonPart : emdmBomItem.wpn ? emdmBomItem.wpn : null
    if (partNumber) {
      let getRes = await emdmModel.getTypeUseRefPartNumber(partNumber)
      // console.log('_getRes:', getRes);
      if (getRes){
        return getRes
      }
    }
    return null
  }

  static prepareBomItemData(src) {
    if (src) {
      let data = JSON.parse(src)
      if (data.length > 0) {
        // group patent_level
        let groupParentRes = _.groupBy(data, (v) => { return v.parentPpId })
        _.forEach(Object.keys(groupParentRes), (v) => {
          // has child parent
          if (v != 'null' && v != 'undefined') {
            // find parent item and set parent item
            let parentbomItemId = uuidv4()
            _.forEach(data, (dv) => {
              if (dv.ppId == v) {
                dv.eproId = parentbomItemId
                // if (dv.cmfForm) {
                dv.epro_partId = uuidv4()
                dv.epro_bomItemId = parentbomItemId
                // }
              }
              if (dv.parentPpId == v) {
                dv.epro_parent_level = parentbomItemId
                let checkHasChild = _.find(data, (hv) => { return hv.parentPpId == dv.ppId })
                if (!checkHasChild) {
                  let childBomItemId = uuidv4()
                  dv.eproId = childBomItemId
                  // if (dv.cmfForm) {
                  dv.epro_partId = uuidv4()
                  dv.epro_bomItemId = childBomItemId
                  // }
                }
              }
            })
          } else {
            // no child parent item
            let val = groupParentRes[v]
            _.forEach(val, (dv) => {
              let find = _.find(data, (hv) => { return dv.ppId == hv.parentPpId })
              if (!find) {
                let parentbomItemId = uuidv4()
                dv.eproId = parentbomItemId
                // if (dv.cmfForm && !_.isEmpty(dv.cmfForm)) {
                dv.epro_partId = parentbomItemId
                dv.epro_bomItemId = parentbomItemId
                // }
              }
            })
          }
        })
      }
      return data
    }
    return null
  }
  static async setBomItemValue(src, ownerId, bomId, verionsId, approveTime, productType, fullPrepareData = null) {
    let fullItemWithoutPartListPrice = fullPrepareData ? fullPrepareData : src
    let bomItemArr = []
    let bomPartArr = []
    let emdmExtraArr = []
    for (let emdmBomItem of src) {
      // 假設為level 2且 下有子階毋需填寫part list
      // const needPartList = emdmBomItem.epro_partId && !emdmBomItem.commonPart && !noNeedPartList
      const odmOemInfo = await this.getRelationVal(RELATIONTYPECACHEKEY, emdmBomItem.mfrType)
      const initaddmodidelInfo = await this.getRelationVal(RELATIONTYPECACHEKEY, emdmBomItem.projectPartStatus)
      const supplyTypeInfo = await this.getRelationVal(RELATIONTYPECACHEKEY, 'AVAP')
      const material_id = await this.getRelationVal(MATERIALSPECANDMATERIALCACHEKEY, emdmBomItem.materialId)
      const materialSpecId = await this.getMaterialSpec(emdmBomItem.partCategory1Id, emdmBomItem.partCategory2Id, emdmBomItem.materialId)
      const noNeedPartListUuidList = await getMeBomCacheValue(NO_NEED_PARTLIST_MATERIAL_AND_MATERIAL_SPEC_ID_LIST)
      const odmOemId = _.isNull(odmOemInfo) ? null : odmOemInfo.id
      const initaddmodidelId = _.isNull(initaddmodidelInfo) ?  null : initaddmodidelInfo.id
      let funcCtgyId = null
      let gbAssyCtgyId = null
      if(emdmBomItem.functionCategory){
        let getFuncCtgyId = await emdmModel.getFuncCtgyIdByName(emdmBomItem.functionCategory)
        if(getFuncCtgyId){
          funcCtgyId = getFuncCtgyId.id
        }
      }
      if(emdmBomItem.assyCategory){
        let getGbAssyCtgyId = await emdmModel.getGbAssyCtgyIdByName(emdmBomItem.assyCategory, productType)
        if(getGbAssyCtgyId){
          gbAssyCtgyId = getGbAssyCtgyId.id
        }
      }
      let emdmExtra = {
        'bom_id': bomId,
        'emdm_id': emdmBomItem.emdmId,
        'source_item_id': emdmBomItem.ppId,
      }
      let bomItemObj = {
        'id': emdmBomItem.eproId,
        'source_item_id': emdmBomItem.ppId,
        'parent_level': emdmBomItem.epro_parent_level ? emdmBomItem.epro_parent_level : null,
        'parts_ctgy_1': emdmBomItem.partCategory1Id,
        'parts_ctgy_2': emdmBomItem.partCategory2Id,
        // 當part_category_2 下沒有material_spec時，卻有material的狀況下，epro使用material當作material_spec
        'material': emdmBomItem.materialId ? material_id : null,
        'material_spec': emdmBomItem.materialSpecId ? emdmBomItem.materialSpecId : materialSpecId,
        'gb_assy_ctgy': gbAssyCtgyId,
        'func_ctgy': funcCtgyId,
        'odm_oem': emdmBomItem.mfrType ? odmOemId : null,
        'initaddmodidel':emdmBomItem.projectPartStatus ? initaddmodidelId : null,
        'order_id': emdmBomItem.allPartsOrder,
        // supply type 設定為AVAP
        'supply_type': supplyTypeInfo.id,
        'part_name': emdmBomItem.wistronPartName ? emdmBomItem.wistronPartName : null,
        // todo: 假設有填寫ref_commom_part number 將此設定為part number
        'ref_part_num': emdmBomItem.commonPart ? emdmBomItem.commonPart : null,
        'part_number': emdmBomItem.commonPart ? emdmBomItem.commonPart : emdmBomItem.wpn ? emdmBomItem.wpn : null,
        /* 'sku0': this.getSkuQty(emdmBomItem.costSkuList, '0'),
        'sku1': this.getSkuQty(emdmBomItem.costSkuList, '1'),
        'sku2': this.getSkuQty(emdmBomItem.costSkuList, '2'),
        'sku3': this.getSkuQty(emdmBomItem.costSkuList, '3'),
        'sku4': this.getSkuQty(emdmBomItem.costSkuList, '4'),
        'sku5': this.getSkuQty(emdmBomItem.costSkuList, '5'), */
        'level': emdmBomItem.level,
        'sub_leve': emdmBomItem.parentPpId ? true : false,
        'part_size_l': !_.isNil(emdmBomItem.partLong) ? emdmBomItem.partLong : null,
        'part_size_w': !_.isNil(emdmBomItem.partWidth) ? emdmBomItem.partWidth : null,
        'part_size_h': !_.isNil(emdmBomItem.partHeight) ? emdmBomItem.partHeight : null,
        'thickness': !_.isNil(emdmBomItem.thickness) ? emdmBomItem.thickness : null,
        'part_size_ef': !_.isNil(emdmBomItem.diameter) ? emdmBomItem.diameter : null,
        'part_size_l2': !_.isNil(emdmBomItem.partLong2) ? emdmBomItem.partLong2 : null,
        'part_size_w2': !_.isNil(emdmBomItem.partWidth2) ? emdmBomItem.partWidth2 : null,
        'part_weight': !_.isNil(emdmBomItem.materialWeight) ? emdmBomItem.materialWeight : null,
        'owner': ownerId,
        'version_id': verionsId,
        'part_size_m': !_.isNil(emdmBomItem.metric) ? emdmBomItem.metric : null,
        'created_time': approveTime ? moment(approveTime).format('YYYY-MM-DD HH:mm:ss') : null,
        'modified_time': approveTime ? moment(approveTime).format('YYYY-MM-DD HH:mm:ss') : null,
        'system_cost': 0,
        'has_child': this.hasChild(fullItemWithoutPartListPrice, emdmBomItem),
        'need_tooling': this.isNeedTooling(emdmBomItem.ifNeedNewToolingClickY),
        'remark': !_.isNil(emdmBomItem.meRemark) ? emdmBomItem.meRemark : null,
        'last_price': emdmBomItem.last_price ? emdmBomItem.last_price : null,
        'suggestion_cost_type': emdmBomItem.suggestion_cost_type ? emdmBomItem.suggestion_cost_type : null,
      }
      for(let i = 0; i <= SKU_MAX; i++) {
        let key = `sku${i}`
        bomItemObj[key] = this.getSkuQty(emdmBomItem.costSkuList, `${i}`)
      }
      const isNoNeedPartList = await this.isNoNeedPartList(bomItemObj.has_child, emdmBomItem, odmOemInfo, bomItemObj, noNeedPartListUuidList)
      const partListFormat = await this.getPartListFormat(emdmBomItem.partCategory1Id, emdmBomItem.partCategory2Id, productType)

      if((!isNoNeedPartList && emdmBomItem.priceResult && partListFormat.hasui)
        || (!partListFormat.hasui && emdmBomItem.priceResult)){
        // 如果有commonPart，則system_cost的價格將在之後變更為commonPart的lastPrice
        bomItemObj.system_cost = _.get(emdmBomItem, 'priceResult.totalPrices', 0)
      }
      bomItemArr.push(bomItemObj)
      emdmExtraArr.push(emdmExtra)
      // todo: 假設有填寫 ref_common_part 無須紀錄part list
      if ((!isNoNeedPartList && partListFormat.format_key) || partListFormat.hasui === false) {
        bomPartArr.push({
          'id': emdmBomItem.epro_partId,
          'bom_item_id': emdmBomItem.epro_bomItemId,
          'formate': partListFormat.format_key || null,
          'partlist_value': JSON.stringify(emdmBomItem.formData || {}),
          'partlist_price': JSON.stringify(emdmBomItem.priceResult || {}),
          'create_time': approveTime ? moment(approveTime).format('YYYY-MM-DD HH:mm:ss') : null,
          'update_time': approveTime ? moment(approveTime).format('YYYY-MM-DD HH:mm:ss') : null,
        })
      }
    }
    return { 'bomItems': bomItemArr, 'bomPartList': bomPartArr, 'emdmExtras': emdmExtraArr }
  }

  static isNeedTooling (ifNeedNewToolingClickY) {
    return (typeof ifNeedNewToolingClickY === 'string' && ifNeedNewToolingClickY.toUpperCase().trim() === 'Y')
  }

  static getSkuQty(src, filterKey) {
    let findRes = _.find(src, (v) => { return v.skuOrder == filterKey })
    let qty = findRes ? findRes.qty : null
    return qty
  }

  static async getPartListFormat(part_ctgy_1, part_ctgy_2, productTypeName) {
    let data = await getMeBomCacheValue(PARTLISTFORMATCACHEKEY)
    let res = _.find(data, (dv) => { return dv.parts_ctgy_1 === part_ctgy_1 && dv.parts_ctgy_2 === part_ctgy_2 && dv.product_type_name.trim().toUpperCase() === productTypeName.trim().toUpperCase()})
    if (res) {
      return res
    }
    return {}
  }

  static async getMaterialSpec(part_ctgy_1, part_ctgy_2, val) {
    let materialSpecData = await getMeBomCacheValue(MATERIALSPECANDMATERIALCACHEKEY)
    if (materialSpecData) {
      let materialSpec = _.find(materialSpecData, (dv) => {
        return dv.part_cate1_id == part_ctgy_1 && dv.part_cate2_id == part_ctgy_2 && dv.material_spec_id == val
      })
      if (materialSpec) {
        return materialSpec.material_spec_id
      }
    }
    return null
  }

  static async getRelationVal(key, val) {
    if (val) {
      if (key == RELATIONTYPECACHEKEY) {
        let data = await getMeBomCacheValue(RELATIONTYPECACHEKEY)
        let res = _.find(data, (dv) => { return dv.name == val })
        if (res) {
          return res
        }
        return null
      } else if (key == STAGECACHEKEY) {
        let stageData = await getMeBomCacheValue(STAGECACHEKEY)
        let stage = _.find(stageData, (dv) => { return dv.id == val })
        if (stage) {
          return stage.stage_name
        }
        return null
      } else if (key == SITECACHEKEY) {
        let stageData = await getMeBomCacheValue(SITECACHEKEY)
        let site = _.find(stageData, (dv) => { return dv.id == val })
        if (site) {
          return site.site_name
        }
        return null
      } else if (key == MATERIALSPECANDMATERIALCACHEKEY) {
        let materialSpecData = await getMeBomCacheValue(MATERIALSPECANDMATERIALCACHEKEY)
        let material = _.find(materialSpecData, (dv) => { return dv.material_id == val })
        if (material) {
          return material.material_id
        }
        return null
      } else {
        return null
      }
    }
    return null
  }

  /* static async getMaterialLastPrice(src, site){
    let partNumber = []
    let price = []
    let minPrice = []
    _.map(src, (v) => {
      let obj = {}
      let requestPartNumber =  v.part_number ? v.part_number.trim().toUpperCase() : null
      if (requestPartNumber) {
        if(partNumber.indexOf(requestPartNumber) <= -1) partNumber.push(requestPartNumber)
      }
      obj.unitPrice = null
      obj.validDate = null
      obj.currency = null
      obj.vendor = null
      obj.vendor_pn = null
      v.last_price = JSON.stringify(obj)
    })

    if (partNumber && partNumber.length > 0) {
      price = await emdmModel.getPartNumberPrice(partNumber)
      let priceExchanged = await getExchangeRateByCurrencyKey(price, 'currency')
      minPrice = getMeLastPrice(priceExchanged, site)
      let groupRes = _.groupBy(price, 'part_number')
      _.forEach(groupRes, (v, key) => {
        minPrice.push(_.maxBy(groupRes[key], function (o) { return o.knumh }))
      })
    }

    if(minPrice && minPrice.length > 0){
      _.forEach(src, (v) =>{
        let requestPartNumber =  v.part_number ? v.part_number.trim().toUpperCase() : null
        let queryRes = _.find(minPrice, (dv) => { return dv.part_number.trim().toUpperCase() == requestPartNumber})
        if(queryRes){
          let obj = {}
          obj.unitPrice = parseFloat(queryRes.unitprice).toString()
          obj.validDate = queryRes.datab
          obj.currency = queryRes.currency
          obj.vendor = queryRes.vendor
          obj.vendor_pn = queryRes.vendor_pn
          v.last_price = JSON.stringify(obj)
        }
      })
    }
  } */
  /**
   * 檢查emdmBomItem是否"不"需要partList
   * @param {Boolean} hasChild
   * @param {Object} emdmBomItem
   * @param {Object} odmOemInfo
   * @param {Object} meBomItem 已將emdmBom轉為meBomItem的物件
   * @param {Object} noNeedPartListUuidList 源於emdmModel.getMaterialSpecAndMaterialNoNeedPartListIdList的資料
   * @returns {Boolean}
   */
  static isNoNeedPartList(hasChild, emdmBomItem, odmOemInfo /* , meBomItem, noNeedPartListUuidList */){
    if( this.isOemTbd(odmOemInfo) ||
        // 2020/2/12 other fill me remark需要呈現partlist 因此拿掉此行判斷
        // this.isNoNeedPattListMaterialRelated(noNeedPartListUuidList, meBomItem) ||
        this.havaLeverageCmpOrReferencePN(emdmBomItem) ||
        hasChild
    ){
      return true
    }
    return false
  }
  /**
   * check emdmBomItem hasChild
   * @param {Array} emdmBomItemList
   * @param {Object} emdmBomItem
   * @returns {Boolean}
   */
  static hasChild(emdmBomItemList, emdmBomItem){
    // if (emdmBomItem.level === ROOTPARENTLEVEL) {
    const childList = _.find(emdmBomItemList, (emdm_bomItem) => { return emdm_bomItem.epro_parent_level == emdmBomItem.eproId })
    return childList ? true : false
    // }
    // return false
  }
  /**
   * check odmOemInfo isOemTbd
   * @param {Object} odmOemInfo
   */
  static isOemTbd(odmOemInfo){
    if(_.isNull(odmOemInfo)){
      return false
    }
    return Object.prototype.hasOwnProperty.call(NO_NEED_PARTLIST_ODM_OEM_LIST, odmOemInfo.name.toUpperCase())
  }
  /**
   *
   * @param {Object} emdmBomItem
   * @returns {Boolean}
   */
  static havaLeverageCmpOrReferencePN(emdmBomItem){
    return emdmBomItem.commonPart ? true : false
  }
  /**
   * check materialRelatedInfo is NoNeedPattList
   * @param {Array} meBomItem 已將emdmBom轉為meBomItem的物件
   * @param {Object} meBomItem 已將emdmBom轉為meBomItem的物件
   * @returns {Boolean}
   */
  static isNoNeedPattListMaterialRelated(noNeedPartListUuid, meBomItem){
    let result = false
    let findRes = _.find(noNeedPartListUuid, (data) =>
      data['parts_ctgy_1'] === meBomItem['parts_ctgy_1'] &&
      data['parts_ctgy_2'] === meBomItem['parts_ctgy_2'] &&
      data['material_spec'] === meBomItem['material_spec'] &&
      data['material'] === meBomItem['material']
    )
    if (findRes) {
      result = true
    }
    return result
  }

  static async delEMDMBomForDebug(bomIds){
    let ppchIds = []
    await asyncForEach(bomIds, async (bomId) => {
      let ppchId = await emdmModel.getPpchIdByBomId(bomId)
      ppchIds.push(ppchId)
      if (ppchId) {
        await emdmModel.delEmdmBom(bomId)
      }
    })
    return ppchIds
  }

  /**
   * 抓取emdmId (新增emdmId欄位時使用的初始化工具)
   */
  static async initEmdmId(){
    let allBomList = await emdmModel.getAllReceiveRecord() // 取出所有emdmproject list
    for (let item of allBomList) {
      let ppchId = item.ppch_id
      let isProjectExists = await emdmModel.checkProjectIsExistByBomId(item.bom_id)
      let emdmProject = await emdmModel.getMDMData(ppchId)
      if (isProjectExists && emdmProject && emdmProject.eprocurement_json_content) {
        logger.debug('initEmdmId for project:', item.bom_id)
        let client = await new tsystemDB()
        let emdmBomItemData = JSON.parse(emdmProject.eprocurement_json_content)
        let dataToInsert = []
        for(let emdmBomItem of emdmBomItemData){
          if(emdmBomItem.hasOwnProperty('emdmId') && emdmBomItem.emdmId) {
            dataToInsert.push({
              'bom_id': item.bom_id,
              'source_item_id': emdmBomItem.ppId,
              'emdm_id': emdmBomItem.emdmId,
            })
          }
        }
        logger.debug('insertData:', dataToInsert)
        if (dataToInsert.length) {
          try {
            await emdmModel.insertEmdmExtra(client, dataToInsert)
          } catch (e) {
            logger.error('initEmdmId with Error:', e)
            await client.rollback()
          }
        }
        await client.commit()
      }
    }
  }
}
module.exports = EMDM
