const oracleDB = require('oracledb')

const Oracle = (dbconfig) => {
  const config = {
    user: dbconfig.user,
    password: dbconfig.password,
    connectString: dbconfig.connectString,
  }
  return {
    Query: (sql, params, isTypeSetObject) => {
      return new Promise(async function (resolve, reject) {
        let conn
        try {
          if(isTypeSetObject){
            oracleDB.outFormat = oracleDB.OBJECT
          }
          conn = await oracleDB.getConnection(config)
          sql = sql.replace(/\$/g, ':')
          let result = await conn.execute(sql, params)
          resolve(result.rows)
        } catch (err) { // catches errors in getConnection and the query
          reject(err)
        } finally {
          if (conn) {   // the conn assignment worked, must release
            try {
              await conn.release()
            } catch (e) {
              console.error(e)
            }
          }
        }
      })
    },
    QueryWhereIn: (sql, binds) => {
      return new Promise(async function (resolve, reject) {
        let conn
        try {
          // string handling for (: replace to dynamic binding values
          sql = sql.substring(0, sql.indexOf('(:') + 1)
          for (let i = 0; i < binds.length; i++)
            sql += (i > 0) ? ', :' + i : ':' + i
          sql += ')'
          // console.log(sql)
          // console.log(binds)
          conn = await oracleDB.getConnection(config)
          let result = await conn.execute(sql, binds)
          resolve(result.rows)
        } catch (err) { // catches errors in getConnection and the query
          reject(err)
        } finally {
          if (conn) {   // the conn assignment worked, must release
            try {
              await conn.release()
            } catch (e) {
              console.error(e)
            }
          }
        }
      })
    },
  }
}
module.exports = Oracle
