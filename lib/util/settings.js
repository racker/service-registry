/**
 *  Copyright 2013 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var EventEmitter = require('events').EventEmitter;
var vm = require('vm');
var path = require('path');
var fs = require('fs');

var logmagic = require('logmagic');
var sprintf = require('sprintf').sprintf;
var optimist = require('optimist');
var misc = require('rackspace-shared-utils/lib/misc');
var fsUtil = require('rackspace-shared-utils/lib/fs');

var existsSync = fs.existsSync ? fs.existsSync : path.existsSync;

var DEFAULT_SETTINGS_PATH = '/opt/farscape-conf/local_settings.js';

var DEFAULT_LOG_FORMAT = [
  ':remote-addr - -',
  '[:date]',
  '":method',
  ':url',
  'HTTP/:http-version"',
  ':status',
  ':res[content-length]',
  '":referrer"',
  '":user-agent"',
  '":txnId"'
].join(' ');

var settings = {
  emitter: new EventEmitter(),

  LOG_LEVEL: 'DEBUG',
  LOG_METHOD: 'console',
  EXPRESS_LOG_FORMAT: DEFAULT_LOG_FORMAT,

  /* Public API settings */
  PUBLIC_API_HOST: '127.0.0.1',
  PUBLIC_API_PORT: 50000,
  MAX_REQUEST_BODY_SIZE: 5000,

  /* Pagination settings */
  PAGINATION_DEFAULT_LIMIT: 100,
  PAGINATION_MAX_LIMIT: 1000,

  /* Control Cassandra cluster settings */
  CASSANDRA_CLUSTER: ['127.0.0.1:9160'],
  CASSANDRA_CONNECTION_TIMEOUT: 4000,
  CASSANDRA_QUERY_TIMEOUT: 5000,
  CASSANDRA_KEYSPACE: 'farscape',
  CASSANDRA_READ_CONSISTENCY: 'ONE',
  CASSANDRA_WRITE_CONSISTENCY: 'ONE',
  SHOW_CQL: true,
  ACCOUNTING_CF: 'accounting',

  /* Zookeeper cluster settings */
  ZOOKEEPER_CLUSTER: ['127.0.0.1:22181'],

  /* MailGun settings */
  MAILGUN_API_URL: 'https://api.mailgun.net/v2/',
  MAILGUN_API_KEY: null,
  MAILGUN_DOMAIN: null,
  MAILGUN_FROM_ADDRESS: null,

  /* Tracing settings */
  TRACING_ENABLED: false,
  TRACING_RESTKIN_URL: null,
  TRACING_AUTH_URL: null,
  TRACING_AUTH_USERNAME: null,
  TRACING_AUTH_API_KEY: null,

  TRACING_MAX_TRACES: 50,
  TRACING_SEND_INTERVAL: 120,

  API_SERVERS_PRIVATE_IPS: [],
  DEBUG: false,
  REGION: 'dev',
  ENVIRONMENT: 'dev',

  /* Rectifier service settings */
  RECTIFICATION_SHARDS: 'ALL',
  MAX_SHARDS: 512,
  // How many accounts can each process rectify at the same time
  RECTIFIER_CONCURRENCY: 1,
  RECTIFY_CONVICTION_THRESHOLD: 5 * 60 * 1000,
  RECTIFIER_SLEEP: 5000,
  RECTIFIER_GRACE_MILLIS: 5000,

  DASHBOARD_IP_WHITELIST: [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8'
  ]
};

function applyRequires(settings) {
  if (settings.LOG_LEVEL) {
    var logmagic = require('logmagic');
    /* TODO: have log destinations here */
    logmagic.route('__root__', logmagic[settings.LOG_LEVEL], settings.LOG_METHOD);
  }
}

function loadLocalSettings() {
  var x,
      localSettings = {},
      sf = (optimist.argv.c || optimist.argv.config) || process.env.FARSCAPE_LOCAL_SETTINGS;

  if (sf === undefined && existsSync(DEFAULT_SETTINGS_PATH)) {
    sf = DEFAULT_SETTINGS_PATH;
  }

  if (sf) {
    if (existsSync(sf)) {
      vm.runInNewContext(fs.readFileSync(sf), localSettings, sf);
    }
    else {
      console.log(sprintf('Config file "%s" not found', sf));
      process.exit(1);
    }
  }

  if (localSettings && localSettings.exports) {
    settings = misc.merge(settings, localSettings.exports);
  }

  // This will add the file used for localSettings
  settings._realized_localsettings = sf;

  for (x in settings) {
    if (settings.hasOwnProperty(x)) {
      exports[x] = settings[x];
      module.exports[x] = settings[x];
    }
  }

  applyRequires(settings);
  settings.emitter.emit('change');
}

loadLocalSettings();

/**
 * @param {String} modulename Module name.
 * @param {String} level Log level.
 * @param {String} msg Log message.
 * @param {?Object} extra Extra Object.
 *
 * @return {Object} Extra object.
 */
exports.logmagicRewriter = function(modulename, level, msg, extra) {
  var keys, key, value1, value2, i, j, leni, lenj, tmp, activeApplication;

  if (!extra instanceof Object) {
    // TODO: Change to throw when we know all the paths with log.xxx are covered
    // with tests and correct.
    return extra;
  }

  if (extra.ctx) {
    if (extra.ctx.account && extra.ctx.account.getKey) {
      extra.accountId = extra.ctx.account.getKey();
    }
    else {
      /* unauthenticated user */
      extra.accountId = null;
    }

    extra.txnId = extra.ctx.txnId;
    delete extra.ctx;
  }

  if (extra.request) {
    if (extra.request.account && extra.request.account.getKey) {
      extra.accountId = extra.request.account.getKey();
    }
    else {
      /* unauthenticated user */
      extra.accountId = null;
    }
    extra.txnId = extra.request.txnId;
    delete extra.request;
  }

  // This is a horrible hack to log timestamps as strings
  if (extra.telescope && extra.telescope.timestamp) {
    extra.telescope = misc.merge({}, extra.telescope);
    extra.telescope.timestamp = extra.telescope.timestamp.toString();
  }

  if (extra.err) {
    extra.full_message = extra.err.stack;
    delete extra.err;
  }
  if (extra.error) {
    extra.full_message = extra.error.stack;
    delete extra.error;
  }

  keys = Object.keys(extra);

  for (i = 0, leni = keys.length; i < leni; i++) {
    key = keys[i];
    value1 = extra[key];

    if (value1 instanceof Array) {
      tmp = [];
      for (j = 0, lenj = value1.length; j < lenj; j++) {
        value2 = value1[j];

        if ((value2 instanceof Object) && (typeof value2.toLogMagic === 'function')) {
          tmp.push(value2.toLogMagic());
        }
        else if ((value2 instanceof Buffer)) {
          tmp.push(value2.toString());
        }
        else {
          tmp.push(value2);
        }
      }

      extra[key] = tmp;
    }
    else if ((value1 instanceof Object)) {
      if ((typeof value1.toLogMagic === 'function')) {
        extra[key] = value1.toLogMagic();
      }
      else if (Object.prototype.toString.call(value1) === '[object Object]') {
        extra[key] = JSON.stringify(value1);
      }
      else if ((value2 instanceof Buffer)) {
        extra[key] = value1.toString();
      }
      else {
        extra[key] = value1;
      }
    }
  }

  return extra;
};

logmagic.addRewriter(exports.logmagicRewriter);

exports.reload = loadLocalSettings;
