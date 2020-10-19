const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time_eedm, env } = require('../../../config')
const job = require('../../utils/crontab/eedm.js')
const altJob = require('../../service/alt.js')

const log4js = require('../logger/logger')
const logger = log4js.getLogger('scheduleEedm')
const aggreEEbom = require('../../utils/crontab/eebom')
const noti = require('../../utils/slack/notification')

process.on('message', async function () {
  // sync at 12:10 sync eebom only
  const r = new schedule.RecurrenceRule()
  schedule.scheduleJob(time_eedm.dailyRule1, async function () {
    let startDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    let endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')

    let reportStatus = []
    logger.debug('sync EEDM begin::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    let EEDM_COST_SUMMARYTABLE_len = await job.syncEEDM_COST_SUMMARYTABLE()
    reportStatus.push({ 'title': 'EEDM_COST_SUMMARYTABLE', 'value': EEDM_COST_SUMMARYTABLE_len, 'short': true })

    let EEDM_PN_LIST_len = await job.syncEEDM_PN_LIST()
    reportStatus.push({ 'title': 'EEDM_PN_LIST', 'value': EEDM_PN_LIST_len, 'short': true })

    let EEDM_PN_PRICE_len = await job.syncEEDM_PN_PRICE()
    reportStatus.push({ 'title': 'EEDM_PN_PRICE', 'value': EEDM_PN_PRICE_len, 'short': true })

    /* ***syncEEDM_PN_PRICE 相等於跑 以下三個function*** */
    // let EEDM_PN_HIGHEST_PRICE_len = await job.syncEEDM_PN_HIGHEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_HIGHEST_PRICE', 'value': EEDM_PN_HIGHEST_PRICE_len, 'short': true })

    // let EEDM_PN_LOWEST_PRICE_len = await job.syncEEDM_PN_LOWEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_LOWEST_PRICE', 'value': EEDM_PN_LOWEST_PRICE_len, 'short': true })

    // let EEDM_PN_2ND_HIGHEST_PRICE_len = await job.syncEEDM_PN_2ND_HIGHEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_2ND_HIGHEST_PRICE', 'value': EEDM_PN_2ND_HIGHEST_PRICE_len, 'short': true })

    let vids = await job.syncEEBomBase()
    reportStatus.push({ 'title': 'EEBomBase', 'value': vids.length, 'short': true })

    let BOM_DETAIL_TABLE_len = await aggreEEbom.aggre_BOM_DETAIL_TABLE(vids)
    reportStatus.push({ 'title': 'BOM_DETAIL_TABLE', 'value': BOM_DETAIL_TABLE_len, 'short': true })

    logger.debug('sync EEDM done::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await noti.sendTaskStatus(startDate, endDate, reportStatus, env)
  })

  // sync at 1:10 fully sync
  schedule.scheduleJob(time_eedm.dailyRule, async function () {
    let startDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')
    let endDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD')

    let reportStatus = []
    logger.debug('sync EEDM begin::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    let EEDM_COST_SUMMARYTABLE_len = await job.syncEEDM_COST_SUMMARYTABLE()
    reportStatus.push({ 'title': 'EEDM_COST_SUMMARYTABLE', 'value': EEDM_COST_SUMMARYTABLE_len, 'short': true })

    let EEDM_PN_LIST_len = await job.syncEEDM_PN_LIST()
    reportStatus.push({ 'title': 'EEDM_PN_LIST', 'value': EEDM_PN_LIST_len, 'short': true })

    let EEDM_Common_Parts_len = await job.syncEEDM_Common_Patrs()
    reportStatus.push({ 'title': 'EEDM_Common_Parts', 'value': EEDM_Common_Parts_len, 'short': true })

    let EEDM_PN_PRICE_len = await job.syncEEDM_PN_PRICE()
    reportStatus.push({ 'title': 'EEDM_PN_PRICE', 'value': EEDM_PN_PRICE_len, 'short': true })

    /* ***syncEEDM_PN_PRICE 相等於跑 以下三個function*** */
    // let EEDM_PN_HIGHEST_PRICE_len = await job.syncEEDM_PN_HIGHEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_HIGHEST_PRICE', 'value': EEDM_PN_HIGHEST_PRICE_len, 'short': true })

    // let EEDM_PN_LOWEST_PRICE_len = await job.syncEEDM_PN_LOWEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_LOWEST_PRICE', 'value': EEDM_PN_LOWEST_PRICE_len, 'short': true })

    // let EEDM_PN_2ND_HIGHEST_PRICE_len = await job.syncEEDM_PN_2ND_HIGHEST_PRICE()
    // reportStatus.push({ 'title': 'EEDM_PN_2ND_HIGHEST_PRICE', 'value': EEDM_PN_2ND_HIGHEST_PRICE_len, 'short': true })

    let EEDM_SPA_PRICE_len = await job.syncEEDM_SPA_PRICE(startDate, endDate)
    reportStatus.push({ 'title': 'EEDM_SPA_PRICE', 'value': EEDM_SPA_PRICE_len, 'short': true })

    let UPDATE_ALT_GROUP = await altJob.updateALT_Group()
    reportStatus.push({ 'title': 'UPDATE_ALT_GROUP', 'value': UPDATE_ALT_GROUP, 'short': true })

    let EEDM_ALT_PRICE_len = await job.syncSAP_ALT_PN()
    reportStatus.push({ 'title': 'EEDM_ALT_PRICE', 'value': EEDM_ALT_PRICE_len, 'short': true })

    let vids = await job.syncEEBomBase()
    reportStatus.push({ 'title': 'EEBomBase', 'value': vids.length, 'short': true })

    let BOM_DETAIL_TABLE_len = await aggreEEbom.aggre_BOM_DETAIL_TABLE(vids)
    reportStatus.push({ 'title': 'BOM_DETAIL_TABLE', 'value': BOM_DETAIL_TABLE_len, 'short': true })

    logger.debug('sync EEDM done::', moment().tz('Asia/Taipei').format('YYYYMMDD HH:mm:ss'))
    await noti.sendTaskStatus(startDate, endDate, reportStatus, env)
  })
})
