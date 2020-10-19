const { systemDB } = require('../helpers/database')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('pcbModule')
let squel = require('squel').useFlavour('postgres')
const PCB_TEMP_ON_CONFLICTSQL = ' ON CONFLICT ("board_type", "part_number", "edm_version_id") DO NOTHING '



class PcbModule {
  static async writePcbBomItemListToTemp(pcbBomItemList){
    let sql = squel.insert()
      .into('wiprocurement.eedm_pcb_temp')
      .setFieldsRows(pcbBomItemList)
      .toParam()
    sql.text += PCB_TEMP_ON_CONFLICTSQL
    try {
      await systemDB.Query(sql)
    } catch (error) {
      logger.error('[PcbModule][writePcbBomItemListToTemp] error : ', error)
      throw new Error(error)
    }
  }
}

module.exports = PcbModule