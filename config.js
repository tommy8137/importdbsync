/* eslint-disable no-magic-numbers */
let fs = require('fs')
let path = require('path')
const configs = {
  pgConfig: {
    provider: 'postgres',
    pgIp: process.env.POSTGRES_IP || '192.168.100.208',
    pgPort: process.env.POSTGRES_PORT || '5432',
    pgDb: process.env.POSTGRES_DB || 'docker',
    pgName: process.env.POSTGRES_USER || 'swpc-user',
    pgPw: process.env.POSTGRES_PASSWORD || 'eprocurement',
    pgSchema: process.env.POSTGRES_SCHEMA || 'wiprocurement',
    idleTimeoutMillis: 1800000,
  },
  eproConfig: {
    eproIp: process.env.EPRO_IP || 'localhost',
    eproPort: process.env.EPRO_PORT ||  '3000',
  },
  lppConfig: {
    lppIp: process.env.LPP_IP || '192.168.101.69',
    lppPort: process.env.LPP_PORT ||  '8004',
    testTimes: 100,
  },
  cbgDBConfig: {
    user: process.env.CBGDB_USER || 'EPUR',
    password: process.env.CBGDB_PASSWORD || 'epur2018',
    connectString: process.env.CBGDB_HOST && process.env.CBGDB_PORT && process.env.CBGDB_SID
      ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.CBGDB_HOST})(PORT=${process.env.CBGDB_PORT}))(CONNECT_DATA=(SID=${process.env.CBGDB_SID})))`
      : '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.37.36.170)(PORT=1523))(CONNECT_DATA=(SID=cbg3qas)))',
  },
  plmDBConfig: {
    user: process.env.PLMDB_USER || 'EXTDATAUSER',
    password: process.env.PLMDB_PASSWORD || 'extdatauser',
    connectString: process.env.PLMDB_HOST && process.env.PLMDB_PORT && process.env.PLMDB_SID
      ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.PLMDB_HOST})(PORT=${process.env.PLMDB_PORT}))(CONNECT_DATA=(SID=${process.env.PLMDB_SID})))`
      : '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.37.36.229)(PORT=1527))(CONNECT_DATA=(SID=PLMDBT)))',
  },
  financeDBConfig: {
    user: process.env.FINANCEDB_USER || 'BIEPROC',
    password: process.env.FINANCEDB_PASSWORD || 'Ep!201809',
    connectString: process.env.FINANCEDB_HOST && process.env.FINANCEDB_PORT && process.env.FINANCEDB_SID
      ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.FINANCEDB_HOST})(PORT=${process.env.FINANCEDB_PORT}))(CONNECT_DATA=(SID=${process.env.FINANCEDB_SID})))`
      : '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.37.32.16)(PORT=1523))(CONNECT_DATA=(SID=BIDBP)))',
  },
  hrDBConfig: {
    user: process.env.HRDB_USER || 'PRCRMNT2018',
    password: process.env.HRDB_PASSWORD || 'PRCRMNT2018',
    connectString: process.env.HRDB_HOST && process.env.HRDB_PORT && process.env.HRDB_SID
      ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.HRDB_HOST})(PORT=${process.env.HRDB_PORT}))(CONNECT_DATA=(SERVICE_NAME = ${process.env.HRDB_SID})))`
      : '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=TPEHRPS.WISTRON.COM)(PORT=1688))(CONNECT_DATA=(SERVICE_NAME = PROD)))',
  },
  eedmDBConfig: {
    user: process.env.EEDMDB_USER || 'Procurement',
    password: process.env.EEDMDB_PASSWORD || 'Procure1234',
    server: process.env.EEDMDB_SERVER || '10.32.48.244',
    database: process.env.EEDMDB_DATABASE || 'e_Procurement',
    options: {
      encrypt: process.env.EEDMDB_ENCRYPT || false, // Use this if you're on Windows Azure
    },
  },
  emdmDBConfig:{
    provider: 'postgres',
    pgIp: process.env.EMDMDB_SERVER || '192.168.101.85',
    pgPort: process.env.EMDMDB_PORT || '9999',
    pgDb: process.env.EMDMDB_DATABASE || 'emdm',
    pgName: process.env.EMDMDB_USER || 'eprocurement',
    pgPw: process.env.EMDMDB_PASSWORD || 'wieprocurement2019',
    pgSchema: process.env.EMDMDB_SCHEMA || 'public',
    idleTimeoutMillis: 300000,
  },
  time: {
    dailyHour: 2,
    dailyMinute: 1,
    dailyRule: '0 0,12 * * *',
  },
  time_eedm: {
    dailyRule: '10 1 * * *',
    dailyRule1: '10 12 * * *',
  },
  time_mebomlastprice:{
    dailyHour: 1,
    dailyMinute: 5,
  },
  time_emdm: {
    dailyRule01: '5 1 * * *',
    dailyRule10: '5 10 * * *',
    dailyRule12: '5 12 * * *',
    dailyRule15: '5 15 * * *',
  },
  env: process.env.NODE_ENV || 'env',
  port: process.env.DB_SYNC_PORT || 3009,
  supplyType: {
    // '1': 'B',
    // '3': 'C',
    // '11': 'A',
    '15': 'S',
    '13': 'V-ODM',
    '14': 'W',
  },
  mailConfig: {
    authInfo:{
      host: process.env.MONITOR_MAIL_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port:25,
      smtp_user:process.env.MONITOR_SMTP_USER || 'AKIAJQNAPPHWQWEMKXRQ',
      smtp_password: process.env.MONITOR_SMTP_PASSWORD || 'BFws8xp38DhhihqP3dZhSIBADKhSJjkspwKcMC3kHy/U',
    },
    sender: process.env.MONITOR_SENDER || 'warning@devpack.cc',
    recevierInfo:{
      epro:process.env.EPRO_MONITOR_RECEIVER || 'zoe_jy_chen@wistron.com, mike_liu@wistron.com,susan_hsieh@wistron.com',
      emdm:process.env.EMDM_MONITOR_RECEIVER || '',
      eedm:process.env.EEDM_MONITOR_RECEIVER || '',
      dev: '',
    },
    disableEnvList: [],
  },
  scheduleInfoList: {
    'cbg':{
      'fileName':'scheduleCbg.js',
      'disableEnvList': [],
    },
    'PlmHrFinance':{
      'fileName':'schedulePlmHrFinance.js',
      'disableEnvList': [],
    },
    'BomBaseData':{
      'fileName':'scheduleBomBaseData.js',
      'disableEnvList': [],
    },
    'XrayDropDownForked':{
      'fileName':'scheduleXray.js',
      'disableEnvList': ['qas'],
    },
    'Eedm':{
      'fileName':'scheduleEedm.js',
      'disableEnvList': ['qas'],
    },
    'SettingData':{
      'fileName':'scheduleSetting.js',
      'disableEnvList': [],
    },
    'Emdm':{
      'fileName':'scheduleEmdm.js',
      'disableEnvList': [],
    },
    'TaskWorker':{
      'fileName':'workerProcess.js',
      'disableEnvList': [],
    },
  },
  ruleInfoList:{
    'Eedm':{
      'boardType':{
        'big': 0,
        'small': 1,
      },
      'isPcbBom':{
        'type1':[/^PCB$/i],
        'hasPartNumberRange':[/^\w+48\.[\d\w]+$/g],
        'tableColumn':{
          'description':[/^PCB/i],
        },
      },
      'isPcbBigBoard':{
        'tableColumn':{
          'board':[/^MB/i],
        },
      },
      'isPcbSmallBoard':{
        'tableColumn':{
          'board':[/^DB/i],
        },
      },
    },
  },
  decimalModuleConfig:{
    'enableAutoUpdate': false,
    'syncSeconds': 300,
    'defaultDecimal': 5,
  },
  redisConfig:{
    'db': process.env.REDIS_DB || 10,
    'host': process.env.REDIS_IP || '192.168.100.207', // */ '127.0.0.1',
    'port': process.env.REDIS_PORT || 6379,
    'tls': {
      ca: [fs.readFileSync(path.join(__dirname, './redis_cert.pem'), 'ascii')],
      checkServerIdentity: () => { return null },
    },
    'password': process.env.REDIS_PASSWORD || 'eprocurement',
  },
  workerConfig:{
    workerName:'db_sync_worker',
    nameSpace: 'taskQueue',
    taskQueueKey: 'task',
    expireSeconds: 3600, // 1hr
    checkExpireSeconds: 600, // 10min
  },
  eproComputerConfig:{
    lastPriceAvaliablePartCategory:{
      'HOUSING':[
        'C_GPU_BKT',
        'HDD_SSD_BKT',
      ],
      'THERMAL':[
        'PAD',
        'GRAPHITE_SHEET',
        'CU_FOIL',
      ],
      'ME_OTHERS':[
        'BOND_DETACH_ADHESIVE',
        'STANDOFF',
        'SCREW',
        'NUT',
      ],
      'EMC':[
        'ABSORBER',
        'EMI_SPRING',
        'SHIELDING_CAN',
        'CONDUCTIVE_TAPE',
        'GASKET',
        'MAGNET',
        'AL_CU_FOIL',
      ],
    },
  },
}

module.exports = configs
