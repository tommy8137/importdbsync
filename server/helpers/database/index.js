const Postgres = require('./postgres')
const Oracle = require('./oracle')
const Mssql = require('./mssql')
const { pgConfig, cbgDBConfig, plmDBConfig, financeDBConfig, hrDBConfig, eedmDBConfig, emdmDBConfig } = require('../../../config.js')

const systemDB = Postgres(pgConfig, { max: 10, application_name: `wieprocure-db-sync-${process.pid}` })
const cbgDB = Oracle(cbgDBConfig)
const plmDB = Oracle(plmDBConfig)
const financeDB = Oracle(financeDBConfig)
const hrDB = Oracle(hrDBConfig)
const eedmDB = Mssql(eedmDBConfig)
const medmDB = Postgres(emdmDBConfig, { max: 10, application_name: `wieprocure-db-sync-${process.pid}` })

module.exports = {
  systemDB,
  cbgDB,
  plmDB,
  financeDB,
  hrDB,
  eedmDB,
  medmDB,
}
