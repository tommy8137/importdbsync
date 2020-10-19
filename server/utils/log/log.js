const { systemDB } = require('../../helpers/database')
const moment = require('moment-timezone')
let deleteDate = moment().tz('Asia/Taipei').subtract(30, 'days').format('YYYY-MM-DD')

async function insertLog(logtype, logname, fetch_count, update_time, dura_sec, status, rsv1 = null, rsv2 = null, rsv3 = null) {
  await systemDB.Query('INSERT INTO wiprocurement.logs (logtype, logname, fetch_count, update_time, dura_sec, status, rsv1, rsv2, rsv3) \
       VALUES ($1 ,$2 ,$3 ,$4 ,$5 ,$6, $7, $8, $9)', [logtype, logname, fetch_count, update_time, dura_sec, status, rsv1, rsv2, rsv3])
}
async function deleteLog() {
  await systemDB.Query('DELETE from  wiprocurement.logs where logType = $1 and create_time < $2', ['syncData', deleteDate])
}
module.exports = {
  insertLog,
  deleteLog,
}

