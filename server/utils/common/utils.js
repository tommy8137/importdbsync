const axios = require('axios')
const https = require('https')
const config = require('../../../config.js')
const EPRO_BASE_URL = `https://${config.eproConfig.eproIp}:${config.eproConfig.eproPort}`
class CommonUtils {
  static async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
  }
  /**
 * 將Array等分的切開
 * @param {array} myArray array資料
 * @param {integer} chunk_size 切割的size
 */
  static chunkArray(myArray, chunk_size){
    let index = 0
    let arrayLength = myArray.length
    let tempArray = []
    for (index = 0; index < arrayLength; index += chunk_size) {
      let myChunk = myArray.slice(index, index + chunk_size)
      // Do something if you want with the group
      tempArray.push(myChunk)
    }
    return tempArray
  }
  /**
   * 發出post請求給eporcurement
   * @param {String} route 
   * @param {Object} body 
   */
  static async requestPostToEprocurement(route, body){
    const url = `${EPRO_BASE_URL}${route}`
    const agent = {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
    try {
      const res = await axios.post(url, body, agent)
      return res
    } catch (error) {
      throw new Error(error)
    }
    
  }
}



module.exports = CommonUtils