const path = require('path')
const fs = require('fs')
const Koa = require('koa')
const cors = require('koa2-cors')
const bodyParser = require('koa-bodyparser')
const koaLogger = require('koa-logger')
const router = require('koa-router')
const app = new Koa()
const apiRouter = require('./server/router/index')
const { port, env, scheduleInfoList } = require('./config.js')
const startSchedule = require('./server/utils/childProcess/startSchedule')
const mailer = require('./server/utils/mail/mail')
const mailMessage = require('./server/utils/mail/message')
const CRASH_ERROR_FILE_PATH = path.join(__dirname, 'crashError.txt')
async function checkCrashError(){
  if(!fs.existsSync(CRASH_ERROR_FILE_PATH)){
    return
  }
  const crashErrorMsg = fs.readFileSync(CRASH_ERROR_FILE_PATH, 'utf8')
  await mailer.sendmail(mailMessage.crashMsg(crashErrorMsg))
  fs.unlinkSync(CRASH_ERROR_FILE_PATH)
}
/*
const cbgForked = fork('./server/utils/childProcess/scheduleCbg.js')
const PlmHrFinanceForked = fork('./server/utils/childProcess/schedulePlmHrFinance.js')
//const SpendingDataForked = fork('./server/utils/childProcess/scheduleSpending.js')
const BomBaseDataForked = fork('./server/utils/childProcess/scheduleBomBaseData.js')
const XrayDropDownForked = fork('./server/utils/childProcess/scheduleXray.js')
const EedmForked = fork('./server/utils/childProcess/scheduleEedm.js')
const SettingDataForked = fork('./server/utils/childProcess/scheduleSetting.js')
//const MeBomForked = fork('./server/utils/childProcess/scheduleMebom.js')
// const EeBomLppForked = fork('./server/utils/childProcess/scheduleEebomLpp.js')
const EmdmForked = fork('./server/utils/childProcess/scheduleEmdm.js')
*/
app.use(koaLogger())
app.use(bodyParser())
app.use(cors({
  origin: function(ctx) {
    if (ctx.url === '/emdm/removeEMDMBOM' || ctx.url === '/emdm/syncEMDMBOM') {
      return '*'
    }
    return false
  },
  exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
  maxAge: 5,
  credentials: true,
  allowMethods: ['POST', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}))
const appRouter = new router()
app.use(async (ctx, next) => {
  ctx.req.setTimeout(0)
  await next()
})
appRouter.use(apiRouter.routes())
app.use(appRouter.routes())
console.log('>> available API list: \n', apiRouter.stack.map(i => `[${i.methods}] ${i.path}`))
app.listen(port)
// startSchedule(scheduleInfoList, env)
// checkCrashError()

process.on('uncaughtException', (error) =>{
  console.log('uncaughtException:', error);
  fs.writeFileSync(CRASH_ERROR_FILE_PATH, JSON.stringify(error, null, 2))
  process.exit(1)
})
/*
console.log(`>> the server is start at port ${port}`)
console.log(`>> the server is running at ${env} environment`)

// sync cbg data
cbgForked.send('go to child process')
console.log('>>> schedule CBG process');

// sync award and rfq project, financial and hr data
PlmHrFinanceForked.send('go to child process')
console.log('>>> schedule PLM/HR/Finance process');

// sync customer nick name
BomBaseDataForked.send('go to child process')
console.log('>>> schedule Bombase process');

SettingDataForked.send('go to child process')
console.log('>>> schedule setting data process');

if (env != 'qas') {
  // sync xray drop down
  XrayDropDownForked.send('go to child process')
  console.log('>>> schedule Xray process');

  // sync eedm data
  EedmForked.send('go to child process')
  console.log('>>> schedule eEDM process');
}

// SpendingDataForked.send('go to child process')
// SettingDataForked.send('go to child process')
// MeBomForked.send('go to child process')
// EeBomLppForked.send('go to child process')

EmdmForked.send('go to child process')
console.log('>>> schedule Emdm process');
*/
