const _ = require('lodash')

class StoreCache {
  constructor() {
    this.cache = new Array()
  }
  findSameKey(specString) {
    let findObject = _.find(this.cache, (c) => c.key == specString)
    if(findObject) {
      return _.assign(findObject.value)
    }else {
      return {}
    }
  }
  storeCache(specString, spa_result, exp_spa_result) {
    this.cache.push({
      key: specString,
      value: _.assign({}, spa_result, exp_spa_result),
    })
    return this.cache
  }
}
module.exports =  StoreCache
