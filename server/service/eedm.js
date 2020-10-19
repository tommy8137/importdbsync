const _ = require('lodash')
// const xrayModel = require('../model/spa.js')
const eedmModel = require('../model/eedm')
let squel = require('squel').useFlavour('postgres')
const { systemDB } = require('../helpers/database')
const uuidv4 = require('uuid/v4')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('eEDMService')

class EEDM {
  static async fetchEEBOM(costSummaryTable) {
    // 從costSummaryTable取出project/version原貌
    let { rawProjects, rawVersions } = await processProjectAndVersionFromCostSummaryTable(costSummaryTable)
    logger.debug(`get data from CostSummaryTable by project&version: Project ${rawProjects.length}, Version: ${rawVersions.length}`)
    // by project + sku 分群, 再從中找出最大upload_time的資料
    let distinctMaxProjects = _.chain(rawProjects).groupBy(item => `${item.project_code}_${item.sku}_${item.stage}_${item.pcbno}_${item.platform}`).mapValues(a => (_.maxBy(a, 'upload_time'))).flatMapDeep().value()

    let distinctMaxVersions = _.chain(rawVersions).groupBy(item => `${item.version}_${item.eebom_project_id}`).flatMapDeep().value()
    // 整理資料 (串接base data & 過濾重複資料)

    let { projectList, versionList } = await mergeWithPlmOrRFQData(distinctMaxProjects, distinctMaxVersions)
    logger.debug(`after merge project&version by 'upload_time' and 'id': Project ${projectList.length}, Version: ${versionList.length}`)

    return {
      project: projectList,
      version: versionList,
    }
  }
}


async function processProjectAndVersionFromCostSummaryTable(raw) {
  let projectList = []
  let versionList = []

  let summaryGroups =  _.groupBy(raw, (summary) => `${summary.projectcode}_${summary.stage}_${summary.sku}_${summary.pcbno}_${summary.platform}`)
  let summaryGroupKey = Object.keys(summaryGroups)
  for (let i = 0; i < summaryGroupKey.length; i++) {
    let summaryGroupsByKey = summaryGroups[summaryGroupKey[i]]

    // 從 group 中取出第一個 作為 project 的資料
    let fristSummary = summaryGroupsByKey[0]
    let versionKey = `${fristSummary.projectcode}_${fristSummary.stage}_${fristSummary.sku}_${fristSummary.pcbno}_${fristSummary.platform}`

    if (fristSummary.projectcode && fristSummary.projectcode.length > 0) {

      // 如果系統有相同的 versionKey, 代表是要upsert project
      // let { rows: originProject } = await systemDB.Query('SELECT id FROM wiprocurement.eebom_projects WHERE project_code=$1 AND stage=$2 AND sku= $3 AND pcbno = $4 AND platform = $5;', [fristSummary.projectcode, fristSummary.stage, fristSummary.sku, fristSummary.pcbno, fristSummary.platform])
      let originProject = await eedmModel.getEebomProjectByKeys(fristSummary)
      let eebomID = originProject ? originProject.id : uuidv4()

      projectList.push({
        'id': eebomID,
        'stage': fristSummary.stage,
        'project_code': fristSummary.projectcode,
        // 'eedm_version': versionKey,
        'sku': fristSummary.sku,
        'version_remark': 'EEDM', // FIXME: tmp code for mark EEDM data
        'upload_time': fristSummary.uploadtime,
        'eedmuploadtime': fristSummary.eedmuploadtime,
        'platform': fristSummary.platform,
        'panel_size': fristSummary.panel_size,
        'pcbno': fristSummary.pcbno,
      })

      let edmVersionList = await eedmModel.getEdmVersionByOption(eebomID, _.map(summaryGroupsByKey, 'uploadtime'))

      // 根據 fristSummary 的originProject[0].id or uuidv4 判斷, 將此 versionKey 組合的 version upsert 到 edm_version裡
      _.map(summaryGroupsByKey, (summary) => {

        // 如果系統此project ID和 version uploadtime, 代表是要upsert version
        // let { rows: originVersion } = await systemDB.Query('SELECT id FROM wiprocurement.edm_version WHERE eebom_project_id=$1 AND upload_time=$2;', [eebomID, summary.uploadtime])
        // let eebomVersionID = originVersion.length > 0 ? originVersion[0].id : uuidv4()
        let originVersion = _.find(edmVersionList, (version) => version.upload_time == summary.uploadtime)
        let eebomVersionID = originVersion ? originVersion.id : uuidv4()
        versionList.push(new Version({
          'id': eebomVersionID,
          'version': summary.uploadtime,
          'eebom_project_id': eebomID,
          'upload_time': summary.uploadtime,
        }))
      })
    } else {
      logger.warn(`version:${versionKey} has no project code, skip.`, fristSummary)
    }
    logger.debug(`project length: ${projectList.length}, version length: ${versionList.length}`)
  }

  return { rawProjects: projectList, rawVersions: versionList }
}

const plantHandling = async (item, projectBase, plantList) => {
  // plant handling // by Ray 提供的邏輯: 若多廠又包含601(新竹廠), 移除該選項後, 取排序最後的一個(數字最大)
  if (projectBase.plantcode) {
    let plmPlant = projectBase.plantcode.split(',').sort().reverse()
    plmPlant = filterPlantCode(plmPlant)

    let plantCodeList = _.map(plmPlant, (p) => `F${p}`)
    let plantCode = plantCodeList[0]
    let plantData = plantList.find(base => plantCode == base.plant)

    item.plant = plantCode
    item.purchasing_organization = plantData.purchase_org
    item.origin_plant_code = JSON.stringify(plantSortOut(plantCodeList, plantList))
    item.plant_code = JSON.stringify(plantSortOut(plantCodeList, plantList))
  }
}

/**
 * 整理 plant 與 purchase org 關係
 * @param {Array} projectPlantCode ex: ['F130', 'F131', 'F140']
 * @param {Array} plantList plant 與 purchase org 關係總表 ex: [{
    plant: 'F130',
    purchase_org: 'PWCD',
  }, {
    plant: 'F131',
    purchase_org: 'PWCD',
  }, {
    plant: 'F132',
    purchase_org: 'PWKS',
  }, {
    plant: 'F140',
    purchase_org: 'PWIH',
  }]
 * @returns {Array} ex: [{
    plants: ["F130", "F131"],
    purchasing_organization: "PWCD"
  }]
 */
const plantSortOut = (projectPlantCode, plantList) => {
  let res = []
  _.forEach(projectPlantCode, (plantCode) => {
    let plantData = plantList.find(plant => plantCode == plant.plant)
    let index = _.findIndex(res, (p) => p.purchasing_organization == plantData.purchase_org)

    if (index < 0) {
      res.push({
        purchasing_organization: plantData.purchase_org,
        plants: plantCode.split(),
      })
    } else {
      res[index].plants.push(plantCode)
    }
  })

  return res
}

/**
 * 從eedm 拿到project code 後, 去 plm 或是 rfq 拿到這個project code project的資料
 * 2020-sprint23 要將 多個廠區資料記錄下來
 */
async function mergeWithPlmOrRFQData(distinctMaxProjects, versionList) {
  // mapping PLM data
  let pcodes = _.chain(distinctMaxProjects).uniq('project_code').map(item => item.project_code).value()
  let { rows: plmList } = await systemDB.Query(getProjects(pcodes))
  let { rows: rfqList } = await systemDB.Query(getRFQProjects(pcodes))
  const { rows: plantList } = await systemDB.Query('SELECT plant,purchase_org FROM wiprocurement.plant_list;')
  let mergeVersions = []
  let mergedProjects = []

  for (let i = 0; i < distinctMaxProjects.length; i++) {
    let item = distinctMaxProjects[i]
    let plmBase = plmList.find(base => item.project_code == base.projectname)
    let rfqBase = rfqList.find(base => item.project_code == base.project_code)
    let versions = _.filter(versionList, base => base.eebom_project_id == item.id)
    mergeVersions = mergeVersions.concat(versions)
    if (plmBase) {
      await plantHandling(item, plmBase, plantList)

      item.customer = plmBase.cusnickname
      item.project_leader = plmBase.projectleader
      item.project_name = plmBase.acrprjname
      item.product_type = plmBase.producttype
      item.caculation_date = 'NOW()'
    } else if (rfqBase) {

      await plantHandling(item, rfqBase, plantList)

      let bussinessOrg = await systemDB.Query(getProductTypeByProfitCenter(rfqBase.profit_center))
      bussinessOrg = bussinessOrg.rows
      let product_type = bussinessOrg.length > 0 ? bussinessOrg[0].product_type_desc : ''
      item.product_type = product_type

      item.customer = rfqBase.cusnickname
      item.project_leader = rfqBase.project_leader
      item.project_name = rfqBase.acrproject_name
      item.caculation_date = 'NOW()'

    } else {
      logger.error(`Project code ${item.project_code} cannot find base data from (plm or rfq) table.`, 'plmBase:', plmBase, 'rfqBase:', rfqBase)
    }
    logger.debug(`merge project item: ${item}`)
    mergedProjects.push(new Project(item))
  }
  // console.log({ projectList: mergedProjects, versionList: mergeVersions })

  return { projectList: mergedProjects, versionList: mergeVersions }
}

const getProductTypeByProfitCenter = (profit_center) => {
  return squel.select().from('wiprocurement.v_businessorg_bo').where('profit_center_key = ?', profit_center).toParam()
}

const getProjects = (pcodes) => {
  let para = (pcodes.length > 0) ? pcodes : ['']
  return squel.select().from('wiprocurement.all_pmprjtbl_for_dashboard').where('projectname in ?', para).toParam()
}

const getRFQProjects = (pcodes) => {
  let para = (pcodes.length > 0) ? pcodes : ['']
  return squel.select().from('wiprocurement.all_rfqproject_for_dashboard').where('project_code in ?', para).toParam()
}

//filter plant status is stoped or invalid plant or 601
//601,199,290,021,111,137,140,145,190,191,192,195,262,265,266,291,292,310,311,330,331,332,335,336,525,551,556,602,605,606,781,280,23N,71N,725,72N
const filterPlantCode = (plmPlant) => {
  // 需要過濾掉 的plant
  let plantcode = '601,199,290,021,111,137,140,145,190,191,192,195,262,265,266,291,292,310,311,330,331,332,335,336,525,551,556,602,605,606,781,280,23N,71N,725,72N'
  let filter = plantcode.split(',').sort().reverse()
  for (let fi = 0; fi < filter.length; fi++) {
    // console.log(filter[fi])
	  if (plmPlant.length > 1 && plmPlant.includes(filter[fi]))
  		plmPlant.splice(plmPlant.indexOf(filter[fi]), 1);
  }
  console.log(plmPlant)

  return _.uniq(plmPlant)
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
    this.plant_code = data.hasOwnProperty('plant_code') ? data.plant_code : JSON.stringify([])
    this.origin_plant_code = data.hasOwnProperty('origin_plant_code') ? data.origin_plant_code : JSON.stringify([])
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


module.exports = EEDM
