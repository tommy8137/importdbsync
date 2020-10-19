const { systemDB } = require('./database')
// const log4js = require('../utils/logger/logger')
const log4js = require('log4js')
const logger = log4js.getLogger('dbHelper')

module.exports = {

  atomic: function (func) {
    async function wrapper(...args) {
      let client = await systemDB.pool.connect()
      args.unshift(client)
      try {
        await client.query('BEGIN')
        logger.debug('--- BEGIN ---')
        let res = await func.apply(this, args)
        // console.log('this',this)
        await client.query('COMMIT')
        logger.debug('--- COMMIT ---')
        await client.release()
        return res
      } catch (err) {
        logger.warn('--- ROLLBACK ---', err)
        await client.query('ROLLBACK')
        await client.release()
        throw err
      }
    }
    return wrapper
  },
}
