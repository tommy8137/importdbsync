const log4js = require('log4js')
log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
    },
    db_sync_file_log: {
      type: 'file', filename: 'logs/db_sync.info.log',
      maxLogSize: 8388608,
      numBackups: 32,
      compress: false,
    },
  },
  categories: {
    default: { appenders: ['out', 'db_sync_file_log'], level: 'debug' },
    dbHelper: { appenders: ['db_sync_file_log'], level: 'warn' },
  },
})
module.exports = log4js
