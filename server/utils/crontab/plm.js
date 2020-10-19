const { systemDB, plmDB } = require('../../helpers/database')
const { insertLog } = require('../../utils/log/log.js')
const mail = require('../../utils/mail/mail.js')
const msg = require('../../utils/mail/message.js')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('crontab plm')
class Plm {
  static async syncAll_PMPRJTBL_FOR_DASHBOARD(startTime, endTime, updateBy) {
    let info = {
      typeName: 'All_PMPRJTBL_FOR_DASHBOARD',
      updateBy: updateBy,
    }
    try {
      logger.debug('----start All_PMPRJTBL_FOR_DASHBOARD----')
      let start = new Date()
      const result = await plmDB.Query('SELECT PROJECTNAME,ACRPRJNAME,SUPERSEDED,CUSNICKNAME,PROFITCENTER,PROJECTLEADER,PRJCREATIONDATE,PRJLASTUPDATE,SEQUENCE,CREATOR,PRJSCHCREATIONDATE,BUSINESSTYPE,PROJECTSTATUS,WARRANTYMONTHS,C0DUEDATE,C1DUEDATE,C2DUEDATE,C3DUEDATE,C4DUEDATE,C5DUEDATE,C6DUEDATE,PROJECTIONC0DUEDATE,PROJECTIONC1DUEDATE,PROJECTIONC2DUEDATE,PROJECTIONC3DUEDATE,PROJECTIONC4DUEDATE,PROJECTIONC5DUEDATE,PROJECTIONC6DUEDATE,ACTUALC0DUEDATE,ACTUALC1DUEDATE,ACTUALC2DUEDATE,ACTUALC3DUEDATE,ACTUALC4DUEDATE,ACTUALC5DUEDATE,ACTUALC6DUEDATE,RFQCODE,GROUPPROJECTCODE,CUSTOMERTYPE,PROJECTNAMESIMPLE,ISRFQ,PRODUCTTYPE,BUDGETPM,CLASSIFICATION,PLANTCODE FROM All_PMPRJTBL_FOR_DASHBOARD WHERE  PRJLASTUPDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND PRJLASTUPDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by PRJLASTUPDATE ASC ', [startTime, endTime], false)
      logger.debug('All_PMPRJTBL_FOR_DASHBOARD length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.all_pmprjtbl_for_dashboard (projectname,acrprjname,superseded,cusnickname,profitcenter,projectleader,prjcreationdate,prjlastupdate,sequence,creator,prjschcreationdate,businesstype,projectstatus,\
       warrantyyear,c0duedate,c1duedate,c2duedate,c3duedate,c4duedate,c5duedate,c6duedate,projectionc0duedate,projectionc1duedate,projectionc2duedate,projectionc3duedate,\
       projectionc4duedate,projectionc5duedate,projectionc6duedate,actualc0duedate,actualc1duedate,actualc2duedate,actualc3duedate,actualc4duedate,\
       actualc5duedate,actualc6duedate,rfqcode,groupprojectcode,customertype,projectnamesimple,isrfq,producttype,budgetpm,classification,plantcode, update_time, update_by)\
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,now(),$45) ON CONFLICT (projectname) \
       DO UPDATE SET acrprjname = $2, superseded = $3,cusnickname = $4, profitcenter = $5, projectleader = $6, prjcreationdate = $7,prjlastupdate = $8, sequence = $9, creator = $10, prjschcreationdate = $11, businesstype = $12,\
       projectstatus  = $13, warrantyyear = $14, c0duedate = $15, c1duedate = $16, c2duedate = $17, c3duedate = $18, c4duedate = $19, c5duedate = $20,\
       c6duedate = $21, projectionc0duedate = $22, projectionc1duedate = $23, projectionc2duedate = $24, projectionc3duedate = $25, projectionc4duedate = $26, projectionc5duedate = $27, projectionc6duedate = $28, actualc0duedate = $29 ,\
       actualc1duedate = $30, actualc2duedate = $31, actualc3duedate = $32, actualc4duedate = $33, actualc5duedate = $34, actualc6duedate = $35, rfqcode = $36, groupprojectcode = $37, customertype = $38, projectnamesimple = $39,\
       isrfq = $40,producttype = $41, budgetpm = $42, classification = $43,plantcode = $44, update_time=now(), update_by=$45 ', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'All_PMPRJTBL_FOR_DASHBOARD', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end All_PMPRJTBL_FOR_DASHBOARD----')
      return result.length
    } catch (e) {
      logger.error('sync All_PMPRJTBL_FOR_DASHBOARD error', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }

  static async syncAll_RFQPROJECT_FOR_DASHBOARD(startTime, endTime, updateBy) {
    let info = {
      typeName: 'All_RFQPROJECT_FOR_DASHBOARD',
      updateBy: updateBy,
    }
    try {
      logger.debug('----start All_RFQPROJECT_FOR_DASHBOARD----')
      let start = new Date()
      const result = await plmDB.Query('SELECT PROJECT_CODE, ACRPROJECT_NAME, SUPERSEDED, \
          PROFIT_CENTER, PROFIT_CENTER_DISP, PROJECT_LEADER, PROJECT_CREATOR, PROJECT_CREATION_DATE, \
          PROJECT_MODIFIER, PROJECT_LAST_UPDATE, REVISION, PROJECT_PLAN_CREATOR, \
          PROJECT_PLAN_CREATION_DATE, PROJECT_PLAN_MODIFIER, PROJECT_PLAN_LAST_UPDATE, ZRFQRECEIVEDATE, \
          ZRFQDUEDATE, PROJECT_STATUS, ZCUSTOMERTYPE, ZRFQTYPE, BUDGETPM, CUSNICKNAME, REALNAME, \
          PLANTCODE FROM ALL_RFQPROJECT_FOR_DASHBOARD \
          WHERE PROJECT_LAST_UPDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') \
          AND PROJECT_LAST_UPDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\') \
          order by PROJECT_LAST_UPDATE ASC ', [startTime, endTime], false)
      logger.debug('All_RFQPROJECT_FOR_DASHBOARD length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.all_rfqproject_for_dashboard \
        (project_code, acrproject_name, superseded, profit_center, profit_center_disp, project_leader, \
          project_creator, project_creation_date, project_modifier, project_last_update, revision, \
          project_plan_creator, project_plan_creation_date, project_plan_modifier, \
          project_plan_last_update, zrfqreceivedate, zrfqduedate, project_status, zcustomertype, \
          zrfqtype, budgetpm, cusnickname, realname, plantcode, update_time, update_by) VALUES \
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, \
            now(), $25) ON CONFLICT (project_code) do update SET acrproject_name = $2, superseded = $3, \
            profit_center = $4, profit_center_disp = $5, project_leader = $6, project_creator = $7, \
            project_creation_date = $8, project_modifier = $9, project_last_update = $10, revision = $11, \
            project_plan_creator = $12, project_plan_creation_date = $13, project_plan_modifier= $14, \
            project_plan_last_update= $15, zrfqreceivedate= $16, zrfqduedate= $17, project_status= $18, \
            zcustomertype= $19, zrfqtype= $20, budgetpm= $21, cusnickname= $22, realname= $23, \
            plantcode= $24, update_time = now(), update_by = $25 ', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'All_RFQPROJECT_FOR_DASHBOARD', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end All_RFQPROJECT_FOR_DASHBOARD----')
      return result.length
    } catch (e) {
      logger.error('sync All_RFQPROJECT_FOR_DASHBOARD error', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }


  static async syncPdmparts(startTime, endTime, updateBy) {
    let info = {
      typeName: 'Pdmparts',
      updateBy: updateBy,
    }
    try {
      logger.debug('----start Pdmparts----')
      let start = new Date()
      const result = await plmDB.Query('SELECT PARTNUMBER,CLASS, CURDBNAME, OBID, REVISION, SEQUENCE, NOMENCLATURE, GENDESC, PRODUCTSTATUS, PROJECTNAME, LIFECYCLESTATE, MAKEBUYINDICATOR, PARTSITECODE, BIGCLASS, SAPDIVISION, PROFITCENTERDISP, MIDDLECLASS, SMALLCLASS, MAJORCODE, MINORCODE, OWNERNAME, ENVSTANDARDSTRING, MATERIALTYPE, ECRNO, AMOUNT, CURRENCY, EQUIVALENTPN, LASTUPDATE, PROFITCENTER, CUSTOMCONTRACTINFO, CMS3BONDEDTYPE, UCCSITECODE, PREVENDOR, VENDORPARTNUMBER, RELEASEDATE, CREATOR, MOUNTFOREGPINDOC, BLOCKED, STATUS, INSDATE, SERNO FROM PDMPARTS WHERE  INSDATE >= TO_DATE(:startTime, \'yyyymmdd hh24:mi:ss\') AND INSDATE <= TO_DATE(:endTime, \'yyyymmdd hh24:mi:ss\')  order by INSDATE ASC ', [startTime, endTime], false)
      logger.debug('Pdmparts length = ', result.length)
      for (let i = 0; i < result.length; i++) {
        result[i].push(updateBy)
        await systemDB.Query('INSERT INTO wiprocurement.PDMPARTS (PARTNUMBER, CLASS, CURDBNAME, OBID, REVISION, SEQUENCE, NOMENCLATURE, GENDESC, PRODUCTSTATUS, PROJECTNAME, LIFECYCLESTATE, MAKEBUYINDICATOR, PARTSITECODE, BIGCLASS, SAPDIVISION, PROFITCENTERDISP, MIDDLECLASS, SMALLCLASS, MAJORCODE, MINORCODE, OWNERNAME, ENVSTANDARDSTRING, MATERIALTYPE, ECRNO, AMOUNT, CURRENCY, EQUIVALENTPN, LASTUPDATE, PROFITCENTER, CUSTOMCONTRACTINFO, CMS3BONDEDTYPE, UCCSITECODE, PREVENDOR, VENDORPARTNUMBER, RELEASEDATE, CREATOR, MOUNTFOREGPINDOC, BLOCKED, STATUS, INSDATE, SERNO, update_time, update_by) \
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,now(),$42) \
      ON CONFLICT (PARTNUMBER)\
      DO UPDATE SET CLASS = $2, CURDBNAME = $3, OBID = $4, REVISION = $5, SEQUENCE = $6, NOMENCLATURE = $7, GENDESC = $8, PRODUCTSTATUS = $9, PROJECTNAME = $10,\
      LIFECYCLESTATE = $11, MAKEBUYINDICATOR = $12, PARTSITECODE = $13, BIGCLASS = $14, SAPDIVISION = $15, PROFITCENTERDISP = $16, MIDDLECLASS = $17, SMALLCLASS = $18,\
      MAJORCODE = $19, MINORCODE = $20, OWNERNAME = $21, ENVSTANDARDSTRING = $22, MATERIALTYPE = $23, ECRNO = $24, AMOUNT = $25, CURRENCY = $26, EQUIVALENTPN = $27, LASTUPDATE = $28,\
      PROFITCENTER = $29, CUSTOMCONTRACTINFO = $30, CMS3BONDEDTYPE = $31, UCCSITECODE = $32, PREVENDOR = $33, VENDORPARTNUMBER = $34, RELEASEDATE = $35, CREATOR = $36,\
      MOUNTFOREGPINDOC = $37, BLOCKED = $38, STATUS = $39, INSDATE = $40, SERNO = $41, update_time = now(), update_by = $42', result[i])
      }
      let dura_sec = (new Date() - start) / 1000
      await insertLog('syncData', 'Pdmparts', result.length, new Date(), dura_sec, 'complete', `${startTime}|${endTime}`)
      logger.debug('----end Pdmparts----')
      return result.length
    } catch (e) {
      logger.debug('sync Pdmparts  error', e)
      info.msg = e
      await mail.sendmail(msg.failedMsg(info))
    }
  }
}
module.exports = Plm
