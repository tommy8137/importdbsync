const moment = require('moment-timezone')
const config = require('../../../config.js')

class MailMessage {
  /**
   * get nodemailer email MsgTemplte
   * @param {String} recevierName
   * @returns {Object}
   */
  static _getMsgTemplte(recevierName = 'epro'){
    return  {
      from: config.mailConfig.sender,
      to: config.mailConfig.recevierInfo[recevierName] || config.mailConfig.recevierInfo.epro,
      subject: '',
      text: '',
    }
  }
  /**
   * sync success msg for nodemailer
   * @param {Object} info
   */
  static successMsg(info, recevierName){
    const msg = this._getMsgTemplte(recevierName)
    msg.subject = `sync ${info.typeName} success at ${moment.tz('Asia/Taipei')}`
    msg.text = `Dear sir,
    Time: ${moment.tz('Asia/Taipei')}
    DB IP: ${config.pgConfig.pgIp}
    Type: ${info.updateBy} sync success
    MESSAGE:  ${info.typeName} sync success`
    return msg
  }
  /**
   * sync failed msg for nodemailer
   * @param {Object} info
   */
  static failedMsg(info, recevierName){
    const msg = this._getMsgTemplte(recevierName)
    msg.subject = `sync ${info.typeName} failed at ${moment.tz('Asia/Taipei')}`,
    msg.text = `Dear sir,
    Enviroment: ${config.env}
    Time: ${moment.tz('Asia/Taipei')}
    DB IP: ${config.pgConfig.pgIp}
    Type: ${info.updateBy} sync failed
    MESSAGE: ${info.msg}`
    return msg
  }
  /**
   * 產生server crash時錯誤訊息的信件內容
   * @param {String} errorMsg 崩潰時的錯誤訊息
   */
  static crashMsg(errorMsg, recevierName){
    const msg = this._getMsgTemplte(recevierName)
    msg.subject = 'DB sync crashed report and restart success',
    msg.text = `Dear sir,
    Enviroment: ${config.env}
    Time: ${moment.tz('Asia/Taipei')}
    DB IP: ${config.pgConfig.pgIp}
    ERROR MESSAGE: ${errorMsg}`
    return msg
  }
}
module.exports = MailMessage
