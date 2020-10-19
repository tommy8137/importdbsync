const mssql = require('mssql')

const Mssql = (dbconfig) => {
  const config = {
    user: dbconfig.user,
    password: dbconfig.password,
    server: dbconfig.server,
    database: dbconfig.database,
    options: {
      encrypt: dbconfig.options.encrypt, // Use this if you're on Windows Azure
    },
  }
  return {
    Query: (sql) => {
      try {
        return new Promise( async (resolve, reject) => {
          let pool = await new mssql.ConnectionPool(config).connect()
          try {
            const request = pool.request() // or: new sql.Request(pool1)
            const result = await request.query(sql)
            resolve(result.recordset)
          } catch (err) {
            console.error('SQL error === ', err)
            reject(err)
          } finally {
            pool.close()
          }
        })
      } catch (e) {
        console.log(`error === ${e}`)
      }
    },
  }
}
module.exports = Mssql