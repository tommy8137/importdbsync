const pg = require('pg')
const { pgConfig } = require('../../../config.js')
const { systemDB } = require('../../helpers/database')

class tPostgre {
  constructor() {
    return new Promise(async (resolve, reject) => {
      try {
        this.pool = systemDB.pool
        pg.defaults.parseInt8 = true
        this.client = await this.pool.connect()
        await this.client.query(`SET search_path TO '${pgConfig.pgSchema}'`)
        await this.client.query('BEGIN')
      } catch (ex) {
        if(this.client){
          this.client.release()
        }
        reject(ex)
      }
      resolve(this)
    })
  }

  async query(sql, params){
    return new Promise(async (resolve, reject) =>{
      try{
        let res = await this.client.query(sql, params)
        resolve(res.rows)
      } catch (ex) {
        console.error(sql)
        await this.rollback()
        reject(ex)
      }
    })
  }

  async queryWithoutRollback(sql, params){
    return new Promise(async (resolve, reject) =>{
      try{
        let res = await this.client.query(sql, params)
        resolve(res.rows)
      } catch (ex) {
        reject(ex)
      }
    })
  }

  async commit(){
    return new Promise(async (resolve, reject) =>{
      try{
        let res = await this.client.query('COMMIT')
        resolve(res)
      } catch (ex) {
        reject(ex)
      }finally {
        this.client.release()
      }
    })
  }

  async rollback(){
    return new Promise(async (resolve, reject) =>{
      try{
        let res = await this.client.query('ROLLBACK')
        resolve(res)
      } catch (ex) {
        reject(ex)
      }finally {
        this.client.release()
      }
    })
  }

}
module.exports = tPostgre
