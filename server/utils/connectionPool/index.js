
'use strict'

const genericPool = require('generic-pool')

class ConnectionPool {
  constructor () {
    if (this.constructor === ConnectionPool) {
      throw new TypeError('Abstract classes can\'t be instantiated.')
    }
  }
  /*
 ██ ███    ██ ██ ████████
 ██ ████   ██ ██    ██
 ██ ██ ██  ██ ██    ██
 ██ ██  ██ ██ ██    ██
 ██ ██   ████ ██    ██
*/
  /**
   *
   * @param {Object} config 連線設定
   */
  init (config) {
    let self = this
    self.pool = genericPool.createPool({
      'create': function () {
        let cClinet = self._getClinet(config)
        return cClinet
      },
      'destroy': function (client) {
        self._disconnect(client)
      },
    }, {
      'max': config.max || 10000,
      'min': config.min || 1,
    })
  }
  /*
 ██████  ███████ ██      ███████  █████  ███████ ███████
 ██   ██ ██      ██      ██      ██   ██ ██      ██
 ██████  █████   ██      █████   ███████ ███████ █████
 ██   ██ ██      ██      ██      ██   ██      ██ ██
 ██   ██ ███████ ███████ ███████ ██   ██ ███████ ███████
*/
  /**
   * 釋放連線
   * @param {Object} connectionObj 連線實例
   */
  release (connectionObj) {
    this.pool.release(connectionObj)
  }
  /*
  ██████  ███████ ████████
 ██       ██         ██
 ██   ███ █████      ██
 ██    ██ ██         ██
  ██████  ███████    ██
*/
  /*
  ██████  ██████  ███    ██ ███    ██ ███████  ██████ ████████ ██  ██████  ███    ██
 ██      ██    ██ ████   ██ ████   ██ ██      ██         ██    ██ ██    ██ ████   ██
 ██      ██    ██ ██ ██  ██ ██ ██  ██ █████   ██         ██    ██ ██    ██ ██ ██  ██
 ██      ██    ██ ██  ██ ██ ██  ██ ██ ██      ██         ██    ██ ██    ██ ██  ██ ██
  ██████  ██████  ██   ████ ██   ████ ███████  ██████    ██    ██  ██████  ██   ████
*/
  /**
   * 取得連線
   * @param  {Number}  [priorit=0] 優先權 -1.低 0.普通 1.高
   * @return {Object}  連線實例
   */
  async getConnection (priorit = 0) {
    try {
      let cConnection = await this.pool.acquire(priorit)
      return cConnection
    } catch (error) {
      throw new Error('Can\'t not get Connection！')
    }
  }

  /*
          ██████  ███████ ████████  ██████ ██      ██ ███    ██ ███████ ████████
         ██       ██         ██    ██      ██      ██ ████   ██ ██         ██
         ██   ███ █████      ██    ██      ██      ██ ██ ██  ██ █████      ██
         ██    ██ ██         ██    ██      ██      ██ ██  ██ ██ ██         ██
 ███████  ██████  ███████    ██     ██████ ███████ ██ ██   ████ ███████    ██
*/
  /**
   * 建立連線
   * @param  {Object} config 連線設定
   */
  // eslint-disable-next-line no-unused-vars
  _getClinet (config) {
    throw new TypeError('Method \'_getClinet()\' must be implemented.')
  }
  /*
         ██████  ██ ███████  ██████  ██████  ███    ██ ███    ██ ███████  ██████ ████████
         ██   ██ ██ ██      ██      ██    ██ ████   ██ ████   ██ ██      ██         ██
         ██   ██ ██ ███████ ██      ██    ██ ██ ██  ██ ██ ██  ██ █████   ██         ██
         ██   ██ ██      ██ ██      ██    ██ ██  ██ ██ ██  ██ ██ ██      ██         ██
 ███████ ██████  ██ ███████  ██████  ██████  ██   ████ ██   ████ ███████  ██████    ██
*/
  /**
    * 關閉連線
    * @param  {Object} connection 連線實例
    */
  // eslint-disable-next-line no-unused-vars
  _disconnect (connection) {
    throw new TypeError('Method \'_disconnect()\' must be implemented.')
  }
}
module.exports = ConnectionPool
