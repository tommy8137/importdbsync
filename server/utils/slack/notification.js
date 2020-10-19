const request = require('request')
const SLACK_URL = 'https://hooks.slack.com/services/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'

const postBody = async (url, payload) => {
  const options = {
    url: url,
    headers: { 'content-type': 'application/json' },
    json: true,
    body: payload,
  }
  // Return new promise
  return new Promise(function (resolve, reject) {
    // Do async job
    request.post(options, function (err, resp, body) {
      if (err) {
        reject(err)
      } else {
        resolve(body)
      }
    })
  })
}

const sendNoti = async (msg = 'This is posted to #general and comes from a bot named webhookbot.') => {
  let data = { 'channel': '#wieprocurement', 'username': 'webhookbot', 'text': msg, 'icon_emoji': ':ghost:' }
  await postBody(SLACK_URL, data)
}
/**
 * @param {*} startTime 同步資料的起始時間點
 * @param {*} endTime 同步資料的結束時間點
 * @param {*} status [{
                    "title": "Priority",
                    "value": "High",
                    "short": false
                }]
 * @param {*} env 執行的環境
 */
const sendTaskStatus = async (startTime, endTime, status, env = 'dev') => {
  if (env == 'dev') return
  let data = {
    'channel': '#wieprocurement',
    'username': 'webhookbot',
    'icon_emoji': ':loudspeaker:',
    'text': `時間區間: ${startTime} ~ ${endTime}，db-sync的結果`,
    'attachments': [
      {
        'color': '#36a64f',
        'title': '處理data數據統計',
        'fields': status,
        'footer': `ENV: ${env}`,
        'footer_icon': 'https://platform.slack-edge.com/img/default_application_icon.png',
      },
    ],
  }
  await postBody(SLACK_URL, data)
}

module.exports = {
  sendNoti,
  sendTaskStatus,
}

// sendNoti('GAGAGAGA!!!!')