const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time, env } = require('../../../config')
const plm = require('../../utils/crontab/plm.js')
const finance = require('../../utils/crontab/finance.js')
const hr = require('../../utils/crontab/hr.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('plmHrFinance')
const noti = require('../../utils/slack/notification')

process.on('message', async function () {
  let startTime
  let endTime
  schedule.scheduleJob(time.dailyRule, async function () {
    let currentTime = moment().tz('Asia/Taipei').format('HH')
    if (currentTime == '00') {
      startTime = moment().tz('Asia/Taipei').subtract(3, 'days').format('YYYYMMDD 12:00:00')
      endTime = moment().tz('Asia/Taipei').subtract(1, 'days').format('YYYYMMDD 23:59:59')
    } else if (currentTime == '12') {
      startTime = moment().tz('Asia/Taipei').subtract(3, 'days').format('YYYYMMDD 00:00:00')
      endTime = moment().tz('Asia/Taipei').format('YYYYMMDD 12:00:00')
    }
    let reportStatus = []
    await hr.truncatePS_EE_PRCRMNT_VW_A()
    logger.debug('start plm,finance,hr time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    let pmProjLength = await plm.syncAll_PMPRJTBL_FOR_DASHBOARD(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'All_PMPRJTBL_FOR_DASHBOARD', 'value': pmProjLength, 'short': true })

    let rfqProjLength = await plm.syncAll_RFQPROJECT_FOR_DASHBOARD(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'All_RFQPROJECT_FOR_DASHBOARD', 'value': rfqProjLength, 'short': true })

    let rfqPdmpartsLength = await plm.syncPdmparts(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'Pdmparts', 'value': rfqPdmpartsLength, 'short': true })

    let vBusinessLength = await finance.syncV_BUSINESSORG_BO(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'V_BUSINESSORG_BO', 'value': vBusinessLength, 'short': true })

    let eeLength = await hr.syncPS_EE_PRCRMNT_VW_A(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'PS_EE_PRCRMNT_VW_A', 'value': eeLength, 'short': true })

    logger.debug('end plm,finance,hr , time::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await noti.sendTaskStatus(startTime, endTime, reportStatus, env)
  })
})

