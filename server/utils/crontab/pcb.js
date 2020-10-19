const path = require('path')
const UUID = require('uuid/v4')
const _ = require('lodash')

const ROOT = path.join(__dirname, '../../../')
const { ruleInfoList } = require(path.join(ROOT, 'config.js'))
const EEDM = ruleInfoList.Eedm
const log4js = require(path.join(ROOT, 'server/utils/logger/logger.js'))
const commonUtils = require(path.join(ROOT, 'server/utils/common/utils.js'))
const pcbModel = require(path.join(ROOT, 'server/model/pcb.js'))
const logger = log4js.getLogger('pcbCrontab')
class PcbCrontab {
  /**
   * 迭代正則陣列，只要陣列中其中一項測試通過，就回true
   * @param {Array} regRule
   * @param {String or Number} testTarget
   * @returns {Boolean}
   */
  static _iterateRegRule(regRule, testTarget){
    for(let reg of regRule){
      if(reg.test(testTarget)){
        return true
      }
    }
    return false
  }
  /**
   *
   * @param {Object} tableColumnRule
   * @param {Object} bomItem
   */
  static _iterateTableColumnRule(tableColumnRule, bomItem){
    const tableColumnKeyList = Object.keys(tableColumnRule)
    for(let tableColumnKey of tableColumnKeyList){
      if(!bomItem.hasOwnProperty(tableColumnKey)){
        continue
      }
      const columnRule = tableColumnRule[tableColumnKey]
      if(this._iterateRegRule(columnRule, bomItem[tableColumnKey])){
        return true
      }
    }
    return false
  }
  static _isPcbByType1(bomType1){
    const isPcbBomType1Rule = EEDM.isPcbBom.type1
    return this._iterateRegRule(isPcbBomType1Rule, bomType1)
  }
  static _isPcbByPartnumber(partnumber){
    const hasPartNumberRangeRule = EEDM.isPcbBom.hasPartNumberRange
    return this._iterateRegRule(hasPartNumberRangeRule, partnumber)
  }
  static _isPcbByTableColumn(bomItem){
    const tableColumnRule = EEDM.isPcbBom.tableColumn
    const tableColumnKeyList = Object.keys(tableColumnRule)
    for(let tableColumnKey of tableColumnKeyList){
      if(!bomItem.hasOwnProperty(tableColumnKey)){
        continue
      }
      const columnRule = tableColumnRule[tableColumnKey]
      if(this._iterateRegRule(columnRule, bomItem[tableColumnKey])){
        return true
      }
    }
    return false
  }
  static isPcbBomItem(bomItem){
    // 滿足pcb的三個條件
    if(this._isPcbByType1(bomItem.type1) ||
      this._isPcbByPartnumber(bomItem.part_number) ||
      this._isPcbByTableColumn(bomItem)
    ){
      return true
    }
    return false
  }
  static _isPcbBigBoard(bomItem){
    const tableColumnRule = EEDM.isPcbBigBoard.tableColumn
    return this._iterateTableColumnRule(tableColumnRule, bomItem)
  }
  static _isPcbSmallBoard(bomItem){
    const tableColumnRule = EEDM.isPcbSmallBoard.tableColumn
    return this._iterateTableColumnRule(tableColumnRule, bomItem)
  }
  static getBomItemListExceptPcbBom(bomItemList){
    const newBomItemList = []
    for(const bomItem of bomItemList){
      if(this.isPcbBomItem(bomItem)){
        continue
      }
      newBomItemList.push(bomItem)
    }
    return newBomItemList
  }
  static getPcbBomItemListByBomItemList(bomItemList){
    const pcbBomItemList = []
    for(const bomItem of bomItemList){
      if(this.isPcbBomItem(bomItem)){
        pcbBomItemList.push(bomItem)
      }
    }
    return pcbBomItemList
  }
  /**
   * @param {Array} pcbBomItemList pcb的基本資訊清單
   * @param {Array} pcbExtraInfoList pcb的額外資訊清單，目前額外資訊含有：
   * part_number : pcb料號，迭代時辨識用
   * board: pcb的大小板資訊
   * plant: pcn的廠區
   */
  static processPcbBomItemList(pcbBomItemList, pcbExtraInfoList){
    const processPcbBomItemList = []
    for(let pcbBomItem of pcbBomItemList){
      // 找出擁有相同part nubmer的額外資訊，這是因為相同的part_number可能還有分大板跟小板
      const thisPcbExtraInfoList =  pcbExtraInfoList.filter((_pcbExtraInfo)=>{
        return _pcbExtraInfo.part_number === pcbBomItem.part_number
      })
      for(let pcbExtraInfo of thisPcbExtraInfoList){
        processPcbBomItemList.push({
          'id':UUID(),
          'edm_version_id':pcbBomItem.edm_version_id,
          'board_type':this._getBoardType(pcbExtraInfo),
          'board':pcbExtraInfo.board,
          'module':pcbExtraInfo.module,
          'qty':pcbBomItem.qty,
          'plant': pcbExtraInfo.plant,
          'part_number':pcbBomItem.part_number,
        })
      }
    }
    return processPcbBomItemList
  }
  static _getBoardType(pcbBomItem){
    if(this._isPcbBigBoard(pcbBomItem)){
      return EEDM.boardType.big
    } else if(this._isPcbSmallBoard(pcbBomItem)){
      return EEDM.boardType.small
    }
    logger.error(`[pcbCrontab][_getBoardType]board type incorrect. bomItemInfo :${JSON.stringify(pcbBomItem, null, 2)}`)
    return null
  }
  /**
   * @param {Array} processPcbBomItemList 經processPcbBomItemList方法處理過之pcbItemList
   */
  static async upsertPcbBomItemListToTemp(processPcbBomItemList){
    const splitPcbBomItemList = commonUtils.chunkArray(processPcbBomItemList, 10)
    for(let partPcbBomItemList of splitPcbBomItemList){
      try {
        await pcbModel.writePcbBomItemListToTemp(partPcbBomItemList)
      } catch (error) {
        logger.error(`[PcbCrontab][upsertPcbBomItemListToTemp] error : ${error}. partPcbBomItemList : ${JSON.stringify(partPcbBomItemList, null, 2)}`)
        throw error
      }
    }
  }
  /**
   *
   * @param {Array} eeBomItemListIncludePcbBoard 包含pcb board資訊的eeobm Item清單
   * @returns {Array}
   */
  static formatPcbExtraInfoByEebomItemList(eeBomItemListIncludePcbBoard){
    return eeBomItemListIncludePcbBoard.map((eebomItem)=>{
      return {
        'part_number': eebomItem.part_number,
        'board':eebomItem.board,
        'plant':eebomItem.plant,
        'module':eebomItem.module,
      }
    })
  }
}
 

module.exports = PcbCrontab