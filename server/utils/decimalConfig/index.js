/* eslint-disable no-magic-numbers */
const { decimalModuleConfig } = require('../../../config.js')
const { systemDB } = require('../../helpers/database/index.js')
const squel = require('squel')
const log4js = require('../logger/logger.js')
const logger = log4js.getLogger('[Decimal Config]')


async function getConfigFromDatabase(){
  let sql = squel.select()
    .field('category')
    .field('parameter_name', 'parameterName')
    .field('value')
    .from('wiprocurement.decimal_config')
  const result = await systemDB.Query(sql.toParam())
  return result.rows ? result.rows : []
}

class DecimalConfig {
  constructor(){
    this.interval = null
    this.config = {}
    if (decimalModuleConfig.enableAutoUpdate) {
      this.interval = setInterval(this.init.bind(this), decimalModuleConfig.syncSeconds * 1000)
    }
    this.init()
  }

  async init() {
    try{
      let tmpConfig = {}
      let dbConfig = await getConfigFromDatabase()
      dbConfig.forEach((item) => {
        let category = item.category
        let parameterName = item.parameterName
        let value = item.value
        if(!tmpConfig.hasOwnProperty(category)){
          tmpConfig[category] = {}
        }
        if(!tmpConfig[category].hasOwnProperty(parameterName)){
          tmpConfig[category][parameterName] = value
        }
      })
      this.config = tmpConfig
    } catch(error) {
      logger.error('init/update with error:', error)
    }
  }

  get(category, parameterName) {
    let result = null
    if(this.config.hasOwnProperty(category)){
      if(this.config[category].hasOwnProperty(parameterName)) {
        result = this.config[category][parameterName]
      } else if(this.config[category].hasOwnProperty('default')) {
        result = this.config[category]['default']
        logger.warn(`Unable to get category:${category} parameterName:${parameterName} using config default:${result} as replacement.`)
      }
    }
    if(result === null){
      result = decimalModuleConfig.defaultDecimal
      logger.warn(`Unable to get category:${category} parameterName:${parameterName} using decimalModuleConfig default:${result} as replacement.`)
    }
    return result
  }

  getCategoryList() {
    return Object.keys(this.config)
  }

  getParameterList(category) {
    if (this.config.hasOwnProperty(category)) {
      return Object.keys(this.config[category])
    } else {
      return []
    }
  }
}

let decimalConfig =  new DecimalConfig()

class DecimalGetter {
  constructor(category){
    this.category = category
  }

  get(parameterName) {
    return decimalConfig.get(this.category, parameterName)
  }

  getWithCategory(...param) {
    return decimalConfig.get(...param)
  }

  getCategoryList() {
    return decimalConfig.getCategoryList()
  }

  getParameterList(category) {
    return decimalConfig.getParameterList(category)
  }

}


module.exports = {
  decimalConfig,
  DecimalGetter,
}
// test
/* setTimeout(() => {
  let getter = new DecimalGetter('MEBom')
  console.log(getter.get('default'))
  console.log(getter.getWithCategory('MEBom', 'default'))
}, 1000) */