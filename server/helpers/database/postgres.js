const pg = require('pg')


const Postgres = (dbconfig, extra) => {
  const pool = new pg.Pool({
    user: dbconfig.pgName,
    host: dbconfig.pgIp,
    database: dbconfig.pgDb,
    password: dbconfig.pgPw,
    port: dbconfig.pgPort,
    idleTimeoutMillis: dbconfig.idleTimeoutMillis,
    ...extra,
  })

  pool.on('error', function (err) {
    console.log('Database error!', err, err.stack)
  })

  return {
    pool,
    Query: (sql, params) => {
      try {
        return new Promise((resolve, reject) => {
          pg.defaults.parseInt8 = true
          pool.connect(function (err, client, done) {
            if (err) {
              console.log(`error === ${err}`)
              reject({ message: 'could not connect to postgres', code: 404 })
            }
            if (client == null || typeof client.query != 'function') {
              new Error('property query null')
            } else {
              client.query(sql, params, function (err, result) {
                done()
                if (err) {
                  console.log(`error === ${err} sql === ${sql} params === ${params}`)
                  reject({ message: 'error running query', code: 400 })
                }
                resolve(result)
              })
            }
          })
        })
      } catch (e) {
        console.log(`error === ${e}`)
      }
    },
    batchInsert: async(sql, params) => {
      pg.defaults.parseInt8 = true
      const client = await pool.connect()
      try {
        if (client == null || typeof client.query != 'function') {
          new Error('property query null')
        } else {
          await client.query('BEGIN')
          for (let i = 0; i < params.length; i++) {
            console.log('=====', i)
            await client.query(sql, params[i])
          }
          const result = await client.query('COMMIT')
          await client.release()
          return result
        }

      } catch (err) {
        await client.query('ROLLBACK')
        console.log(`error === ${err}`)
      }
    },
  }
}

module.exports = Postgres
