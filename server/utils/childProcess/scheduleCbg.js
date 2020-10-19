const schedule = require('node-schedule')
const moment = require('moment-timezone')
const { time, env  } = require('../../../config')
const cbg = require('../../utils/crontab/cbg.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('cbg')
const noti = require('../../utils/slack/notification')

process.on('message', async function ()  {
  let startTime
  let endTime
  schedule.scheduleJob(time.dailyRule, async function () {
    let currentTime = moment().tz('Asia/Taipei').format('HH')
    if(currentTime == '00') {
      startTime = moment().tz('Asia/Taipei').subtract(1, 'days').format('YYYYMMDD 12:00:00')
      endTime = moment().tz('Asia/Taipei').subtract(1, 'days').format('YYYYMMDD 23:59:59')
    } else if(currentTime == '12') {
      startTime = moment().tz('Asia/Taipei').format('YYYYMMDD 00:00:00')
      endTime = moment().tz('Asia/Taipei').format('YYYYMMDD 12:00:00')
    }
    logger.debug('start cbg, time::', moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss'))
    let reportStatus = []
    let EPUR_ITEMSPEC_len = await cbg.syncEPUR_ITEMSPEC(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_ITEMSPEC', 'value': EPUR_ITEMSPEC_len, 'short': true })

    let EPUR_SOURCEDEF_len = await cbg.syncEPUR_SOURCEDEF(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_SOURCEDEF', 'value': EPUR_SOURCEDEF_len, 'short': true })

    let EPUR_SOURCERPROXY_len = await cbg.syncEPUR_SOURCERPROXY(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_SOURCERPROXY', 'value': EPUR_SOURCERPROXY_len, 'short': true })

    let EPUR_VGROUP_len = await cbg.syncEPUR_VGROUP(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_VGROUP', 'value': EPUR_VGROUP_len, 'short': true })

    let EPUR_TYPE1_len = await cbg.syncEPUR_TYPE1(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_TYPE1', 'value': EPUR_TYPE1_len, 'short': true })

    let EPUR_TYPE2_len = await cbg.syncEPUR_TYPE2(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_TYPE2', 'value': EPUR_TYPE2_len, 'short': true })

    let EPUR_SPEC_TITLE_len = await cbg.syncEPUR_SPEC_TITLE(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_SPEC_TITLE', 'value': EPUR_SPEC_TITLE_len, 'short': true })

    let EPUR_ITEMTYPE_len = await cbg.syncEPUR_ITEMTYPE(startTime, endTime, 'crontab')
    reportStatus.push({ 'title': 'EPUR_ITEMTYPE', 'value': EPUR_ITEMTYPE_len, 'short': true })

    logger.debug('end cbg, time::', moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss'))
    await noti.sendTaskStatus(startTime, endTime, reportStatus, env)
  })
})

