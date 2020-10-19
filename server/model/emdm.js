const { systemDB, medmDB } = require('../helpers/database')
let squel = require('squel').useFlavour('postgres')
const moment = require('moment')
const uuidv4 = require('uuid/v4')

const getMeBomProjectConflictSql = () => {
  let onConflictClause = ' ON CONFLICT ("project_code", "mdm_version") DO NOTHING '

  return onConflictClause
}

module.exports = {
  /**
    * 使用 MDM view 取得 ME bom project,item & part list value
    */
  getMDMData: async (ppch_id) => {
    let sql = squel.select()
      .from('public.view_project_part_checkin_history')
      .where('ppch_id = ?', ppch_id)
    const result = await medmDB.Query(sql.toParam())
    return result.rows[0] ? result.rows[0] : null
  },
  getMDMList: async (req, lastRecord) => {
    let sql = squel.select()
      .field('ppch_id')
      .from('public.view_project_part_checkin_history')
    if (req) sql.where('ppch_id in ?', req)
    if (lastRecord) sql.where('approve_time > ?', lastRecord)
    sql.order('ppch_id', true)
    const result = await medmDB.Query(sql.toParam())
    return result.rows
  },
  insertMeBomProject: async (client, data) => {
    try {
      let sql = squel.insert().into('wiprocurement.bom_projects')
      if (data.customer) sql.set('customer', data.customer)
      if (data.product_type_id) sql.set('product_type', squel.select().field('type_name').from('formula.product_type').where('id = ?', data.product_type_id))
      if (data.approve_user_id) sql.set('project_leader', data.approve_user_id)
      if (data.approve_user_id) sql.set('approved_by', data.approve_user_id)
      if (data.approve_user_name) sql.set('approved_by_name', data.approve_user_name)
      sql.set('project_code', data.project_code)
      if (data.project_name) sql.set('project_name', data.project_name)
      sql.set('create_time', moment().utc().format())
      if (data.site) sql.set('site', squel.select().field('site_name').from('formula.site').where('id = ?', data.site))
      if (data.product_unit_size) sql.set('product_spec', data.product_unit_size)
      if (data.approve_time) sql.set('approve_time', moment(data.approve_time).format('YYYY-MM-DD HH:mm:ss'))
      sql.set('project_source', 'EMDM')
      sql.set('source_version', data.version)
      if (data.production_unit_size) sql.set('product_spec', data.production_unit_size)
      sql.set('create_by', 'EMDM')
      if (data.cost_sku_remark){
        const costSkuRemark = JSON.parse(data.cost_sku_remark)
        let skuDescription = ''
        Object.keys(costSkuRemark).forEach((skuKey)=>{
          skuDescription = (skuDescription === '') ? `${skuKey}:${costSkuRemark[skuKey]}` : `${skuDescription}\n${skuKey}:${costSkuRemark[skuKey]}`
        })
        sql.set('sku_desc', skuDescription)
      }
      if (data.sourcer_permission_id) sql.set('sourcer_permission_id', data.sourcer_permission_id)
      sql.returning('id')
      sql.returning('product_type')
      sql.returning('site')
      let res = await client.query(sql.toParam())
      return res.length > 0 ? res[0] : null
    } catch (error) {
      console.error('[EmdmModel][insertMeBomProject] error :', error)
      throw error
    }
  },
  updateMeBomProject: async (client, data) => {
    let sql = squel.update().table('wiprocurement.bom_projects')
    sql.set('customer', data.customer)
    sql.set('product_type', squel.select().field('type_name').from('formula.product_type').where('id = ?', data.product_type_id))
    sql.set('project_leader', data.approve_user_id)
    sql.set('approved_by', data.approve_user_id)
    sql.set('project_code', data.project_code)
    sql.set('project_name', data.project_name)
    sql.where('id = ?', squel.select().field('a.id').from(squel.select().from('wiprocurement.bom_projects').where('project_source = ?', 'EMDM'), 'a')
      .join('wiprocurement.bom_stage_version', 'b', 'b.bom_id = a.id').where('a.project_code = ?', data.project_code)
      .where('a.site = ?', squel.select().field('site_name').from('formula.site').where('id = ?', data.site_id))
      .where('b.stage_id = ?', data.stage)
    )
    sql.returning('id')
    sql.returning('product_type')
    sql.returning('site')
    let res = await client.query(sql.toParam())
    return res.length > 0 ? res[0] : null
  },
  inertMeBomDesignee: async (client, bomId, approverUserId) => {
    // set one default person
    let sql = squel.insert().into('wiprocurement.bom_designee')
    sql.set('bom_project_id', bomId)
    sql.set('seq', '1')
    // sql.set('user_id', squel.select().field('emplid').from('wiprocurement.user').where('emplid = ?', approverUserId))
    sql.set('user_id', approverUserId)
    sql.set('update_time', moment().utc().format())
    sql.returning('id')
    let res = await client.query(sql.toParam())
    return res.length > 0 ? res[0].id : null
  },
  insertMeBomVersion: async (client, data) => {
    let sql = squel.insert().into('wiprocurement.bom_stage_version')
    sql.set('bom_id', data.bomId)
    sql.set('stage_id', data.stage)
    sql.set('id', uuidv4())
    sql.set('version_name', '0.0')
    sql.set('create_time', moment().utc().format())
    sql.returning('id')
    let res = await client.query(sql.toParam())
    return res.length > 0 ? res[0].id : null

  },
  insertMeBomItem: async (client, data) => {
    let sql = squel.insert().into('wiprocurement.bom_item').setFieldsRows(data)
    await client.query(sql.toParam())
  },
  insertEmdmExtra: async (client, data) => {
    let sqlEmdmExtra = squel.insert().into('wiprocurement.bom_item_emdm_extra').setFieldsRows(data)
    await client.query(sqlEmdmExtra.toString() + ' on conflict do nothing')
  },
  insertMeBomPartlist: async (client, data) => {
    let sql = squel.insert().into('wiprocurement.bom_partlist_value').setFieldsRows(data)
    await client.query(sql.toParam())
  },
  getStage: async () => {
    let sql = squel.select().field('id').field('stage_name')
      .from('wiprocurement.bom_stage').where('disable_time is null')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getSite: async () => {
    let sql = squel.select().field('id').field('site_name')
      .from('formula.site').where('disable_time is null')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getRelationType: async () => {
    let sql = squel.select().field('id', 'id').field('operation_name', 'name')
      .from('formula.operation').where('disable_time is null')
      .union_all(
        squel.select().field('id', 'id').field('odm_oem_name', 'name')
          .from('formula.odm_oem').where('disable_time is null')
      ).union_all(
        squel.select().field('id', 'id').field('supply_type_name', 'name')
          .from('formula.supply_type').where('disable_time is null')
      )
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  checkProjectIsExist: async (projectCode, emdmVersion) => {
    let sql = squel.select().field('id', 'bom_id').from('wiprocurement.bom_projects')
      .where('source_version = ?', emdmVersion)
      .where('project_code = ?', projectCode)
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  checkProjectIsExistByBomId: async (bomId) => {
    let sql = squel.select().field('id', 'bom_id').from('wiprocurement.bom_projects')
      .where('id = ?', bomId)
      .where('project_source = \'EMDM\'')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getPartListFormat: async () => {
    let sql = squel.select()
      .field('b.format_key')
      .field('a.parts_ctgy_1')
      .field('a.parts_ctgy_2')
      .field('b.hasui')
      .field('pt.type_name', 'product_type_name')
      .from('wiprocurement.bom_partlist_config', 'a')
      .join('wiprocurement.bom_partlist_format', 'b', 'a.format = b.id')
      .right_join('wiprocurement.bom_partlist_config_product_type', 'cpt', 'cpt.config_id = a.id')
      .left_join('formula.product_type', 'pt', 'pt.id = cpt.product_type_id')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getMaterialSpecAndMaterialName: async (data) => {
    if (!data.materialId && !data.materialSpecId) {
      return null
    }

    let sql = squel
      .select()
      // .field('part_cate1_name', 'partCategory1')
      // .field('part_cate2_name', 'partCategory2')
      .field('material_spec_name', 'materialSpec')
      .field('material_name', 'material')
      .from('formula.v_me_bom_materialspec_and_material_value')

    // if (data.partCategory1Id) {
    //   sql.where('part_cate1_id = ?', data.partCategory1Id)
    // }
    // if (data.partCategory2Id) {
    //   sql.where('part_cate2_id = ?', data.partCategory2Id)
    // }
    if (data.materialSpecId && !data.materialId) {
      sql.where('material_spec_id = ?', data.materialSpecId)
    }

    if (!data.materialSpecId && data.materialId) {
      sql.where('material_spec_id = ?', data.materialId)
    }
    if (data.materialSpecId && data.materialId) {
      sql.where('material_id = ?', data.materialId)
    }

    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0] : null
  },
  getParts1AndParts2Name: async (data) => {
    let sql = squel
      .select()
      .field('p1.category_name', 'partCategory1')
      .field('p2.category_name', 'partCategory2')
      .from('formula.part_category_1 ', 'p1')
      .join('formula.part_category_2', 'p2', 'p1.id = p2.part_category_1_id')

    if (data.partCategory1Id) {
      sql.where('p1.id = ?', data.partCategory1Id)
    }
    if (data.partCategory2Id) {
      sql.where('p2.id = ?', data.partCategory2Id)
    }

    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0] : null
  },
  getMaterialSpecAndMaterial: async () => {
    let sql = squel.select().from('formula.v_me_bom_materialspec_and_material_value')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getAllReceiveRecord: async () => {
    let sql = squel.select()
      .field('epro_me_project_id', 'bom_id')
      .field('emdm_ppch_id', 'ppch_id')
      .from('wiprocurement.emdm_receive_record')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : []
  },
  getLastReceiveRecord: async () => {
    let sql = squel.select().field('max(approve_time)', 'approve_time').from('wiprocurement.emdm_receive_record')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0].approve_time : null
  },
  insertReceiveRecord: async (data) => {
    let sql = squel.insert().into('wiprocurement.emdm_receive_record').setFieldsRows(data)
    await systemDB.Query(sql.toParam())
  },
  insertReceiveFailRecord: async (data) => {
    let sql = squel.insert().into('wiprocurement.emdm_receive_fail_record').setFieldsRows(data)
    await systemDB.Query(sql.toParam())
  },
  getPartNumberPrice: async (partNumber) => {
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
      .field('a.lifnr', 'vendor_code')
      .field('c.vbase', 'vendor')
      .field('a.mfrpn', 'vendor_pn')
      .from(squel.select().from('wiprocurement.eina').where('bmatn in ?', partNumber)
        .where(squel.str(`(MFRNR is not null or MFRNR <> '${''}') AND (LOEKZ is null or LOEKZ = '${''}')`)), 'a')
      .join(squel.select().from('wiprocurement.a018_konp').where('datbi >= ?', moment().format('YYYY-MM-DD'))
        .where(squel.str(`LOEVM_KO is null or LOEVM_KO = '${''}'`)), 'b', 'a.matnr=b.matnr')
      .left_join('wiprocurement.epur_vgroup', 'c', 'a.lifnr =c.vbase')
      .order('knumh', false)
      .order('matnr')
      .order('datab', false)
    const result = await systemDB.Query(sql.toParam())
    return result.rows
  },
  getMaterialSpecAndMaterialNoNeedPartListIdList: async () => {
    let sql = squel.select()
      .field('config.*')
      .from('wiprocurement.bom_itme_validate_exception_config', 'config')
      .left_join('wiprocurement.bom_itme_validate_exception_type', 'type', 'type.id = config.type')
      .where('type.exception_type_value = ?', 'no_need_partlist')
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows : null
  },
  getFuncCtgyIdByName: async (funcCtgyName) => {
    let sql = squel.select()
      .field('id')
      .from('formula.func_ctgy')
      .where('func_ctgy_name ilike ?', funcCtgyName)
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0] : null
  },
  getProductTypeByName: async (productTypeName) => {
    let product_type_sql = squel.select()
      .field('id')
      .from('formula.product_type')
      .where('type_name = ?', productTypeName)
    const result = await systemDB.Query(product_type_sql.toParam())
    return result.rows.length > 0 ? result.rows[0].id : null
  },
  getProductTypeById: async (productTypeId) => {
    let product_type_sql = squel.select()
      .field('id')
      .field('type_name')
      .from('formula.product_type')
      .where('id = ?', productTypeId)
    const result = await systemDB.Query(product_type_sql.toParam())
    return result.rows.length > 0 ? result.rows[0].type_name : null
  },
  getGbAssyCtgyIdByName: async (gbAssyCtgyName, productType) => {
    let product_type_sql = squel.select()
      .field('id')
      .from('formula.product_type')
      .where('type_name = ?', productType)
    let sql = squel.select()
      .field('id')
      .from('formula.gb_assy_ctgy')
      .where('gb_assy_ctgy_name ilike ?', gbAssyCtgyName)
    if (productType) {
      sql.where(`product_type_id = (${product_type_sql.toString()})`)
    }
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0] : null
  },
  getOlderProjectId: async (project_code) => {
    let sql = squel.select()
      .field('id')
      .from('wiprocurement.bom_projects')
      .where('project_code = ?', project_code)
      .where('project_source = ?', 'EMDM')
      .limit(1)
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0].id : -1
  },
  insertBomProjectParams: async (client, bomId, productTypeName, ignoreConflict = false, olderProjectId = -1) => {
    let subsql = null
    if (olderProjectId > 0) {// 抓舊專案值做預設值
      subsql = squel.select()
        .field(`${bomId}`)
        .field('para.id')
        .field('pv.value')
        .field('pv.value_type')
        .from('wiprocurement.bom_project_parameter', 'para')
        .from('wiprocurement.bom_project_parameter_value', 'pv')
        .where('para.product_type_id = ?',
          squel.select()
            .field('id')
            .from('formula.product_type')
            .where('type_name = ?', productTypeName)
        )
        .where('pv.bom_id = ?', olderProjectId)
        .where('pv.type_id = para.id')
    } else {// 從資料庫取預設值
      subsql = squel.select()
        .field(`${bomId}`)
        .field('para.id')
        .field('pv.value')
        .field('pv.value_type')
        .from('wiprocurement.bom_project_parameter', 'para')
        .from('formula.parameter_value', 'pv')
        .where('para.product_type_id = ?',
          squel.select()
            .field('id')
            .from('formula.product_type')
            .where('type_name = ?', productTypeName)
        )
        .where('pv.parameter_id = para.default_value_parameter_id')
        .where('pv.activate_date_id = ?',
          squel.select()
            .field('MAX(id)')
            .from('formula.schedule_date')
            .where('formula_type_id = para.formula_type_id')
            .where('product_type_id = para.product_type_id')
        )
    }

    let sql = squel.insert().into('wiprocurement.bom_project_parameter_value')
      .fromQuery(
        ['bom_id', 'type_id', 'value', 'value_type'],
        subsql
      )
    let insertSql = sql.toParam()
    if (ignoreConflict) {
      insertSql = sql.toString() + 'on conflict do nothing'
    }
    let result = await client.query(insertSql)
    return result
  },
  getPpchIdByBomId: async (bomId) => {
    let sql = squel.select()
      .from('wiprocurement.emdm_receive_record')
      .where('epro_me_project_id = ?', bomId)
    const result = await systemDB.Query(sql.toParam())
    return (result.rows.length) ? result.rows[0].emdm_ppch_id : null
  },
  delEmdmBom: async (bomId) => {
    const result = await systemDB.Query(`select wiprocurement.test_fn_eproc_delete_bom_project(${bomId})`)
    return result
  },
  getTypeUseRefPartNumber: async (refPartNumber) => {
    let sql = squel.select()
      .from('formula.v_partnumber_category_1_category_2')
      .where('partnumber = ?', refPartNumber)
      .where('isDisabled = false')

    const result = await systemDB.Query(sql.toParam())
    return (result.rows.length) ? result.rows[0] : null
  },
  getBomProjectInfoById: async (bomId) => {
    let sql = squel.select()
      .field('*')
      .from('wiprocurement.bom_projects')
      .where('id = ?', bomId)
      .where('project_source = ?', 'EMDM')
      .limit(1)
    const result = await systemDB.Query(sql.toParam())
    return result.rows.length > 0 ? result.rows[0] : null
  },
}
