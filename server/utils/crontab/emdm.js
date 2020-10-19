const moment = require('moment-timezone')
const { insertLog } = require('../../utils/log/log.js')
const _ = require('lodash')
const uuidv4 = require('uuid/v4')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('Emdm')
const emdmService = require('../../service/emdm')
const EMDM_RECEVIER_KEY = 'emdm'
class EmdmCrontab {
  static async syncEmdm(req = null) {
    let res = null
    let info = { typeName: 'syncEmdm', updateBy: 'syncEmdm' }
    try {
      let start = new Date()
      logger.debug(`---- start sync me bombase ----${new Date()}`)
      res = await emdmService.syncMEBOM(req)
      logger.debug(`There's ${res.syncCount} project synced`)
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'MEBomData', res.syncCount, new Date(), dura_sec, 'complete')
      logger.debug(`---- end syncMEBOM ----${new Date()}`)
    } catch (err) {
      info.msg = err
      await mail.sendmail(msg.failedMsg(info, EMDM_RECEVIER_KEY))
    }
    return res
  }
}

module.exports = EmdmCrontab