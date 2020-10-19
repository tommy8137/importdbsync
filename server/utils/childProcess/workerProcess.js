const mailer = require('../../../server/utils/mail/mail')
const log4js = require('../logger/logger')
const logger = log4js.getLogger('[workerProcess]')
const TaskWorker = require('../taskWorker/index.js')

const { workerConfig } = require('../../../config')
const mailMessage = require('../../../server/utils/mail/message')

const partComputer = require('../../service/emdmPartComputer')

async function failNotify(error) {
  logger.error('send error mail.')
  let errorObj = {
    typeName: 'function solution list',
    updateBy: 'workerProcess',
    msg: error,
  }
  await mailer.sendmail(mailMessage.failedMsg(errorObj))
}

process.on('message', async function () {
  let taskWorker = new TaskWorker({
    ...workerConfig,
    workerSkills:{
      partlist:{
        computer:{
          processFn: partComputer.processFn.bind(partComputer),
          resultFn: partComputer.resultFn.bind(partComputer),
        },
      },
    },
    failNotify,
  })
  taskWorker.run()
})