const _ = require('lodash')
const xrayModel = require('../model/spa.js')

class VendorFilter {
  constructor() {

    this.isFiltered = function (vcode) {
      let result = _.find(this.value, ['vendor_code', vcode])
      // if find vendor code, should filtered => return false
      if (!result) return true
      else return false
    }
    return (async () => {
      // All async code here
      this.value = await xrayModel.getVendorFilter()
      return this // when done
    })()
  }
}
module.exports = VendorFilter