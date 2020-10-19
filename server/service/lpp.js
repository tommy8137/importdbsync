const { lppConfig } = require('../../config.js')
const https = require('https')
const http = require('http')

const Promise = require('bluebird')
const log4js = require('../utils/logger/logger')
const logger = log4js.getLogger('lpp post api')
class Lpp {
  static getLppModule(tmp) {
    return Promise.try(() => {
      let result
      try {
        result = getLppData(tmp)
      } catch(e) {
        console.log('error:::', e)
      }
      return result
    })
  }
}

module.exports = Lpp

function getLppData(ctx) {
  if(lppConfig.lppIp == 'auth.devpack.cc'){
    return new Promise((fulfill, reject) => {
      const change = JSON.stringify(ctx)
      const option = {
        hostname: lppConfig.lppIp,
        // port: lppConfig.lppPort,
        // path: '/bom/partlist/gethmMaterialPrice',
        path: '/ocpu/library/eProcurement/R/predfunc_LPP/json?digit=6',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        rejectUnauthorized: false,
      }

      const req = https.request(option, (res) => {
        let str = ''
        res.setEncoding('utf8')
        if(res.statusCode == 201) {
          res.on('data', (chunk) => {
            str += chunk
          })
          res.on('end', () => {
            fulfill(JSON.parse(str))
          })
        }else if (res.statusCode == 400) {
          res.on('data', function(d) {
            try {
              const errorMessage = JSON.parse(d.toString())
              logger.error(errorMessage.message)
              reject(false)
            // reject({ message: errorMessage.message, code: errorMessage.code })
            } catch(e) {
              logger.error(d.toString())
              reject(false)
            // reject({ message: d.toString() })
            }
          })
        } else if (res.statusCode == 408) {
          logger.error('Request Timeout')
          reject(false)
        // reject({ message: 'Request Timeout', code: 400 })
        } else {
          logger.error('modles/risks test err')
          reject(false)
        // reject({ message: 'modles/risks test err', code: 500 })
        }
      })
      req.on('error', ex => {
        logger.error(ex.message)
        reject(false)
      // reject({ message: ex.message, code: 500 })
      })
      req.write(change)
      req.end()
    })
  } else {
    return new Promise((fulfill, reject) => {
      const change = JSON.stringify(ctx)
      const option = {
        hostname: lppConfig.lppIp,
        port: lppConfig.lppPort,
        // path: '/bom/partlist/gethmMaterialPrice',
        path: '/ocpu/library/eProcurement/R/predfunc_LPP/json?digit=6',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        rejectUnauthorized: false,
      }

      const req = http.request(option, (res) => {
        let str = ''
        res.setEncoding('utf8')
        if(res.statusCode == 201) {
          res.on('data', (chunk) => {
            str += chunk
          })
          res.on('end', () => {
            fulfill(JSON.parse(str))
          })
        }else if (res.statusCode == 400) {
          res.on('data', function(d) {
            try {
              const errorMessage = JSON.parse(d.toString())
              logger.error(errorMessage.message)
              reject(false)
            // reject({ message: errorMessage.message, code: errorMessage.code })
            } catch(e) {
              logger.error(d.toString())
              reject(false)
            // reject({ message: d.toString() })
            }
          })
        } else if (res.statusCode == 408) {
          logger.error('Request Timeout')
          reject(false)
        // reject({ message: 'Request Timeout', code: 400 })
        } else {
          logger.error('modles/risks test err')
          reject(false)
        // reject({ message: 'modles/risks test err', code: 500 })
        }
      })
      req.on('error', ex => {
        logger.error(ex.message)
        reject(false)
      // reject({ message: ex.message, code: 500 })
      })
      req.write(change)
      req.end()
    })
  }
}
