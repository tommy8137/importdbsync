const nodemailer = require('nodemailer')
const _ = require('lodash')
const { mailConfig : { authInfo, sender, disableEnvList }, env} = require('../../../config.js')
const AWS_EKS_SMTP_URI = 'email-smtp.us-east-1.amazonaws.com'
const ENABLE_EMAIL = _.isNil(disableEnvList.find((disableEnv)=> disableEnv === env)) ? true : false
let connectInfo = {
  host: authInfo.host,
  port: authInfo.port,
  logger: false,
  debug: false, // include SMTP traffic in the logs
}

if(authInfo.host === AWS_EKS_SMTP_URI){
  connectInfo.port = 25
  connectInfo.auth = {
    user: authInfo.smtp_user,
    pass: authInfo.smtp_password,
  }
}
let transporter = nodemailer.createTransport(connectInfo, {
  from: sender,
})

async function sendmail(message) {
  // if(ENABLE_EMAIL){
  //   await transporter.sendMail(message)
  // }
  console.log('test')
}
module.exports = {
  sendmail,
}
