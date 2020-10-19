const StateMachine = require('./index.js');
// local test
(async () => {
  let cRedis = new StateMachine({
    'db': 3,
    'host': '127.0.0.1',
    'port': 6379,
    'authPass': '',
    'key': 'ACCESSTOKEN',
  })
  console.log('check', await cRedis.check(1))
  console.log('lock', await cRedis.lock(1, '123456789'))
  console.log('check', await cRedis.check(1))
  console.log('lock', await cRedis.update(1, '123456788'))
  console.log('check', await cRedis.check(1))
  console.log('unlock', await cRedis.unlock(1))

  cRedis.lock(2, '123456789', (err, data) => {
    console.log('lock', err)
    console.log('lock', data)
    cRedis.check(2, (err, data) => {
      console.log('check', err)
      console.log('check', data)
      cRedis.unlock(2, (err, data) => {
        console.log('unlock', err)
        console.log('unlock', data)
      })
    })
  })
})()
