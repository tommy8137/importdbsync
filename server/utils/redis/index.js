(function () {
  'use strict'

  const ConnectionPool = require('../connectionPool/index.js')
  const { promisify } = require('util')
  const redis = require('redis')
  const log4js = require('../logger/logger')
  const logger = log4js.getLogger('redis')

  class Redis extends ConnectionPool {
    constructor (config) {
      super()
      this.init(config)
    }
    /*
              ██████  ███████ ████████ ██████  ███████ ███████ ██    ██ ██      ████████
             ██       ██         ██    ██   ██ ██      ██      ██    ██ ██         ██
             ██   ███ █████      ██    ██████  █████   ███████ ██    ██ ██         ██
             ██    ██ ██         ██    ██   ██ ██           ██ ██    ██ ██         ██
     ███████  ██████  ███████    ██    ██   ██ ███████ ███████  ██████  ███████    ██
    */
    /**
     *
     * @param {Any} error
     * @param {Any} data
     */
    _getResult (error = null, data = null) {
      return {
        'error': error,
        'data': data,
      }
    }
    /*
    ██████  ███████ ███████ ██████   ██████  ███    ██ ███████ ███████
    ██   ██ ██      ██      ██   ██ ██    ██ ████   ██ ██      ██
    ██████  █████   ███████ ██████  ██    ██ ██ ██  ██ ███████ █████
    ██   ██ ██           ██ ██      ██    ██ ██  ██ ██      ██ ██
    ██   ██ ███████ ███████ ██       ██████  ██   ████ ███████ ███████
    */
    response (result, cb) {
      if (typeof cb === 'function') {
        return cb(result.error, result.data)
      } else {
        return result
      }
    }
    /*
    ██████  ███████  ██████  ██    ██ ███████ ███████ ████████
    ██   ██ ██      ██    ██ ██    ██ ██      ██         ██
    ██████  █████   ██    ██ ██    ██ █████   ███████    ██
    ██   ██ ██      ██ ▄▄ ██ ██    ██ ██           ██    ██
    ██   ██ ███████  ██████   ██████  ███████ ███████    ██
                        ▀▀
    */
    /**
     * 對redis發出請求
     * @param {String} fnName
     * @param  {...any} args
     */
    async request (fnName, ...args) {
      let cClient = null
      try {
        cClient = await this.getConnection()
        let fnKey = `${fnName}Async`
        if (cClient.hasOwnProperty(fnKey)) {
          let result = await cClient[fnKey].apply(cClient, args)
          this.release(cClient)
          return this._getResult(null, result)
        } else {
          this.release(cClient)
          return this._getResult(`no such function as name:${fnKey} in Redis`)
        }
      } catch (error) {
        if (cClient) {
          this.release(cClient)
        }
        return this._getResult(error)
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
     * 取得客戶端實例。
     * @param {*} config
     */
    _getClinet (config) {
      let cfg = {
        'host': config.host || '127.0.0.1',
        'port': config.port || 6379,
        'db': config.db || 0,
        'tls': config.tls || null,
        'max': 1,
      }
      if (config.hasOwnProperty('password')) {
        cfg.password = config.password
      }
      let cRedisClient = redis.createClient(cfg).on('error', (error) => {
        logger.error(`redis clinet Error : ${JSON.stringify(error, null, 2)}`);
        // throw new Error(`redis clinet Error : ${JSON.stringify(error, null, 2)}`)
      }).once('connect', (err) => {
        if (err) {
          logger.error(`[redisPool]connect Error:${err}`)
          throw new Error(`redis clinet connect Error :${(typeof err === 'object') ? JSON.stringify(err, null, 2) : err}`)
        }
      }).on('reconnecting', () => {
        logger.info('redis is reconnecting....')
      }).on('ready', () => {
        logger.info('redis connect success')
      })
      for (let prop in cRedisClient) {
        if (typeof cRedisClient[prop] === 'function') {
          cRedisClient[`${prop}Async`] = promisify(cRedisClient[prop].bind(cRedisClient))
        }
      }
      return cRedisClient
    }
    /*
            ██████  ██ ███████  ██████  ██████  ███    ██ ███    ██ ███████  ██████ ████████
            ██   ██ ██ ██      ██      ██    ██ ████   ██ ████   ██ ██      ██         ██
            ██   ██ ██ ███████ ██      ██    ██ ██ ██  ██ ██ ██  ██ █████   ██         ██
            ██   ██ ██      ██ ██      ██    ██ ██  ██ ██ ██  ██ ██ ██      ██         ██
    ███████ ██████  ██ ███████  ██████  ██████  ██   ████ ██   ████ ███████  ██████    ██
    */
    /**
     * 斷線
     * @param {*} redisClient
     */
    _disconnectClinet (redisClient) {
      redisClient.quit()
    }

    /*
    ******************************************************
    ███████ ████████ ██████  ██ ███    ██  ██████  ███████
    ██         ██    ██   ██ ██ ████   ██ ██       ██
    ███████    ██    ██████  ██ ██ ██  ██ ██   ███ ███████
         ██    ██    ██   ██ ██ ██  ██ ██ ██    ██      ██
    ███████    ██    ██   ██ ██ ██   ████  ██████  ███████
    ******************************************************
    */
    /**
     * 將鍵key設定為指定的「字符串」值。
     * 如果 key 已經保存了一個值，那麼這個操作會直接覆蓋原來的值，並且忽略原始類型。
     *
     * @param {String} key
     * @param {String} value
     * @param {Function} cb
     */
    async set (key, value, cb) {
      let cResult = await this.request('set', key, value)
      return this.response(cResult, cb)
    }

    /**
     * 返回key的value。
     * 如果key不存在，返回特殊值null。
     * 如果key的value不是string，就返回错误，因为GET只處理string類型的values。
     *
     * @param  {String}   key
     * @param  {Function} cb [回傳錯誤或資料]
     */
    async get (key, cb) {
      let cResult = await this.request('get', key)
      return this.response(cResult, cb)
    }

    /*
    ********************************
    ██   ██ ███████ ██    ██ ███████
    ██  ██  ██       ██  ██  ██
    █████   █████     ████   ███████
    ██  ██  ██         ██         ██
    ██   ██ ███████    ██    ███████
    ********************************
    */
    /**
    * 生產環境不適用此方法
    * 查找所有符合給定模式pattern（正則表達式）的 key 。
    * 時間複雜度為O(N)，N為數據庫裡面key的數量。
    * 例如，Redis在一個有1百萬個key的數據庫裡面執行一次查詢需要的時間是40毫秒。
    *
    * @param  {String}   pattern [ 支援的正則表達模式：
                               h?llo 匹配 hello, hallo 和 hxllo
                               h*llo 匹配 hllo 和 heeeello
                               h[ae]llo 匹配 hello 和 hallo, 但是不匹配 hillo
                               h[^e]llo 匹配 hallo, hbllo, … 但是不匹配 hello
                               h[a-b]llo 匹配 hallo 和 hbllo
                               如果你想取消字符的特殊匹配（正則表達式，可以在它的前面加\。
                             ]
    * @param  {Function} cb  [回傳Array格式資料]
    */
    async keys (pattern, cb) {
      let cResult = await this.request('keys', pattern)
      return this.response(cResult, cb)
    }

    /**
    * 查找所有符合給定模式pattern（正則表達式）的 key 。
    * 時間複雜度為O(N)，N為數據庫裡面key的數量。
    * 例如，Redis在一個有1百萬個key的數據庫裡面執行一次查詢需要的時間是40毫秒。
    *
    * @param  {String}   pattern [ 支援的正則表達模式：
                               h?llo 匹配 hello, hallo 和 hxllo
                               h*llo 匹配 hllo 和 heeeello
                               h[ae]llo 匹配 hello 和 hallo, 但是不匹配 hillo
                               h[^e]llo 匹配 hallo, hbllo, … 但是不匹配 hello
                               h[a-b]llo 匹配 hallo 和 hbllo
                               如果你想取消字符的特殊匹配（正則表達式，可以在它的前面加\。
                             ]
    * @param  {Function} cb  [回傳Array格式資料]
    */
    async scan (pattern, cb) {
      let curser = 0
      let result = []
      let cResult = {}
      do {
        cResult = await this.request('scan', curser, 'MATCH', pattern)
        result = result.concat(cResult.data[1])
        curser = cResult.data[0]
      } while (!cResult.error && curser !== '0')
      cResult.data = result
      return this.response(cResult, cb)
    }

    /**
     * 返回key是否存在。
     *
     * @param  {String}   key
     * @param  {Function} cb  [回傳1或0] 1.存在, 0.不存在
     */
    async exists (key, cb) {
      let cResult = await this.request('exists', key)
      return this.response(cResult, cb)
    }

    /**
   * 刪除key，如果刪除的key不存在，則直接忽略。
   *
   * @param  {String} keys [刪除多個Key格式：key1 key2 key3]
   * @param  {Function} cb  [回傳true或false]
   */
    async del (keys, cb) {
      let cResult = await this.request('del', keys)
      return this.response(cResult, cb)
    }

    /*
    *******************************
    ██   ██  █████  ███████ ██   ██
    ██   ██ ██   ██ ██      ██   ██
    ███████ ███████ ███████ ███████
    ██   ██ ██   ██      ██ ██   ██
    ██   ██ ██   ██ ███████ ██   ██
    *******************************
    */
    /**
    * 設置 key 指定的hash中指定名稱的值。
    * 如果 key 指定的hash值不存在，會創建一個新的hash值並與 key 關聯。
    * 如果名稱在hash值中存在，它將被更新。
    *
    * @param  {String}   key
    * @param  {String}   field hash值中指定名稱
    * @param  {String}   value 值
    * @param  {Function} cb    [ 回傳true或false
    *                            true :如果field是一個新的名稱
    *                            false :如果field原來在map裡面已經存在
    *                          ]
    */
    async hset (key, field, value, cb) {
      let cResult = await this.request('hset', key, field, value)
      return this.response(cResult, cb)
    }

    /**
     * 設置 key 指定的hash中指定名稱的值。
     * 如果 key 指定的hash值不存在，會創建一個新的hash值並與 key 關聯。
     * 如果名稱在hash值中存在，它將不會被更新。
     *
     * @param  {String}   key
     * @param  {String}   field hash值中指定名稱
     * @param  {String}   value 值
     * @param  {Function} cb    [ 回傳true或false
     *                            true :如果field是一個新的名稱
     *                            false :如果field原來在map裡面已經存在
     *                          ]
     */
    async hsetnx (key, field, value, cb) {
      let cResult = await this.request('hsetnx', key, field, value)
      return this.response(cResult, cb)
    }

    /**
     * 設置 key 指定的hash值中指定名稱的值。
     * 該命令將更新所有在hash值中存在的名稱。
     * 如果 key 指定的hash值不存在，會創建一個新的hash值並與 key 關聯
     *
     * @param  {String}   key
     * @param  {Object}   obj 要更新的料表 EX:{'ha1':0, 'ha2':1, 'ha3':5}
     * @param  {Function} cb
     */
    async hmset (key, obj, cb) {
      let cResult = await this.request('hmset', key, obj)
      return this.response(cResult, cb)
    }
    /**
     * 增加 key 指定的hash值中指定名稱的[數值]。
     * 如果 key 不存在，會創建一個新的hash值並與 key 關聯。
     * 如果名稱不存在，則名稱的值在該操作執行前被設置為 0
     * 如果名稱存在，則名稱的值加上 value 。
     * HINCRBY 支援的值的範圍限定在 64位 有符號整數
     *
     * @param  {String}   key
     * @param  {String}   field hash值中名稱
     * @param  {Number}   value 要增加的量
     * @param  {Function} cb    [回傳增量後的數值]
     */
    async hincrby (key, field, value, cb) {
      let cResult = await this.request('hincrby', key, field, value)
      return this.response(cResult, cb)
    }

    /**
     * 返回 key 指定的hash值中該名稱所關聯的值
     *
     * @param  {String}   key
     * @param  {String}   field hash值中名稱
     * @param  {Function} cb    (err, value)
     */
    async hget (key, field, cb) {
      let cResult = await this.request('hget', key, field)
      return this.response(cResult, cb)
    }

    /**
     * 返回 key 指定的hash值中數個指定名稱的值。
     * 對於hash值中不存在的每個名稱，返回 null 值。
     * 因為不存在的keys被認為是一個空的hash值，對一個不存在的 key 執行 HMGET 將返回一個只含有 null 值的列表
     * 此處針對playerManager特性，若回傳值中有任一個值是null，就視為此key不存在。
     *
     * @param  {String}   key        []
     * @param  {String}   fields     要取的hash名稱 EX:['data1', 'data6']
     * @param  {Function} cb         [回傳Array格式]
     */
    async hmget (key, fields, cb) {
      let cResult = await this.request('hmget', key, fields)
      return this.response(cResult, cb)
    }

    /**
     * 返回 key 指定的hash值中所有的名稱和值，並以物件包裝回傳。
     *
     * @param  {String}   key
     * @param  {Function} cb  [回傳Object格式]
     */
    async hgetall (key, cb) {
      let cResult = await this.request('hgetall', key)
      return this.response(cResult, cb)
    }

    /**
   * 從 key 指定的hash值中移除指定的域。在hash值中不存在的域將被忽略。
   * 如果 key 指定的hash值不存在，它將被認為是一個空的hash值，該命令將返回0。
   * 此處重新包狀，1返回true, 0返回false
   *
   * @param  {String}   key   []
   * @param  {String}   field []
   * @param  {Function} cb    [回傳true或false]
   */
    async hdel (key, field, cb) {
      let cResult = await this.request('hdel', key, field)
      return this.response(cResult, cb)
    }

    /*
    ****************************************************************************************************
    ███████  ██████  ██████  ████████      █████  ███    ██ ██████      ███████ ███████ ████████ ███████
    ██      ██    ██ ██   ██    ██        ██   ██ ████   ██ ██   ██     ██      ██         ██    ██
    ███████ ██    ██ ██████     ██        ███████ ██ ██  ██ ██   ██     ███████ █████      ██    ███████
         ██ ██    ██ ██   ██    ██        ██   ██ ██  ██ ██ ██   ██          ██ ██         ██         ██
    ███████  ██████  ██   ██    ██        ██   ██ ██   ████ ██████      ███████ ███████    ██    ███████
    ****************************************************************************************************
    */
    /**
     * 增加指定成員的分數，若該成員不存在則建立。
     * 回傳值為更新後的分數{Number}。
     * @param  {String}   key   鍵值
     * @param  {Number}   score 分數值
     * @param  {String}   member 成員名稱
     * @param  {Function} cb
     * @return {error, data}
     */
    async zincrby (key, score, member, cb) {
      let cResult = await this.request('zincrby', key, score, member)
      cResult.data = parseFloat(cResult.data)
      return this.response(cResult, cb)
    }

    /**
     * 回傳指定名次區間的成員(大到小排序){(+)>>>(-)}
     * @param  {String}   key   鍵值
     * @param  {Number}   start 起始位置 EX:0.第一名(分數最大), 1.第二名, -1.最後一名(分數最小)
     * @param  {Number}   end   結束位置
     * @param  {Function} cb
     * @return {error, data}
     */
    async zrevrange (key, start, end, isWithScores, cb) {
      let cResult = null
      if (isWithScores) {
        cResult = await this.request('zrevrange', key, start, end, 'withscores')
      } else {
        cResult = await this.request('zrevrange', key, start, end)
      }
      return this.response(cResult, cb)
    }

    /**
     * 移除指定名次區間的成員(小到大排序){(-)<<<(+)}
     * 並回傳移除成員總數
     * @param  {String}   key   鍵值
     * @param  {Number}   start 起始位置 EX:0.第一名(分數最小), 1.第二名, -1.最後一名(分數最大)
     * @param  {Number}   end   結束位置
     * @param  {Function} cb
     * @return {error, data}
     */
    async zremRangeByRank (key, start, end, cb) {
      let cResult = await this.request('zremrangebyrank', key, start, end)
      return this.response(cResult, cb)
    }

    /**
     * 回傳集合中成員總筆數
     * @param  {String}   key   鍵值
     * @param  {Function} cb
     * @return {error, data}
     */
    async zcard (key, cb) {
      let cResult = await this.request('zcard', key)
      return this.response(cResult, cb)
    }

    /*
    ************************************************
    ███████ ███████ ██████  ██    ██ ███████ ██████
    ██      ██      ██   ██ ██    ██ ██      ██   ██
    ███████ █████   ██████  ██    ██ █████   ██████
         ██ ██      ██   ██  ██  ██  ██      ██   ██
    ███████ ███████ ██   ██   ████   ███████ ██   ██
    *************************************************
    */
    /**
     * 刪除當前數據庫裡面的所有數據。
     * 這個命令永遠不會出現失敗。
     * 這個操作的時間複雜度是O(N),N是當前數據庫的keys數量。
     *
     * @param  {Function} cb []
     */
    async flushdb (cb) {
      let cResult = await this.request('flushdb')
      return this.response(cResult, cb)
    }
  }
  let clientCache = new Map()// client 快取，防止產生過多client。
  module.exports.init = function (auth) {
    let cacheKey = `${auth.db}_${auth.host}_${auth.port}`// 快取ID
    if (clientCache.has(cacheKey)) { // 搜尋快取
      return clientCache.get(cacheKey) // 回傳快取client
    } else {
      let client = new Redis(auth) // 建立client
      clientCache.set(cacheKey, client) // 快取client
      return client// 回傳client
    }
  }
  /* (async () => {
    let test = new Redis({
      'db': 2,
      'host': '127.0.0.1',
      'port': 6379,
      'authPass': ''
    });
    for (let i = 0; i < 5000; i++) {
      await test.request('set', `USERS:UID_${i}`, 'test');
    }
    let cResult = await test.scan('USERS:UID_*');
    console.log(cResult);
    console.log(cResult.data.length);
  })(); */
})()
