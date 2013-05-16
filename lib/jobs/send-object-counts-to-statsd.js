#!/usr/bin/env node

var async = require('async');
var sprintf = require('sprintf').sprintf;
var optimist = require('optimist');

var instruments = require('rackspace-shared-utils/lib/instruments');
var log = require('logmagic').local('jobs.send-object-counts-to-statds');

var initialize = require('../init').initialize;
var Account = require('../db/models/account').Account;
var DbOperationContext = require('../db/context').DbOperationContext;
var accountOps = require('../db/ops/account');
var serviceOps = require('../db/ops/service');
var configurationOps = require('../db/ops/configuration');
var email = require('../util/email');

var argv = require('optimist')
    .usage('Sends usage stats to statsd and optionally via email.\n' +
           'Usage: $0 [--send-email] [--target=my@email.com]')
    .describe('target', 'Address to send the stats email to')
    .describe('concurrency', 'Number of accounts to process at once')
    .boolean(['send-email'])
    .default('concurrency', 6)
    .argv;

if (argv.h || argv.help) {
  console.log(optimist.help());
  process.exit(1);
}

if (argv['send-email'] && !argv.target) {
  console.log(optimist.help());
  console.log('"target" option is required when using --send-email');
  process.exit(1);
}

var CONCURRENCY = parseInt(argv.concurrency, 10);

if (isNaN(CONCURRENCY)) {
  console.log('--concurrency argument must be a number');
  process.exit(1);
}

function logAndIgnoreErrorAndIncreaseCounter(acKey, objType, result, callback) {
  return function wrappedCallback(err, res) {
    if (err) {
      log.error('Error while retrieving ${type} for account', {'type': objType, 'acKey': acKey, 'err': err});
      callback();
      return;
    }

    result[objType] = res.length;
    callback();
  };
}

/**
 * Retrieve all the objects for an account and generate usage object.
 *
 * Note: errors which happen when retrieving the objects here aren't fatal.
 */
function processAccount(acKey, callback) {
  var ac, ctx, result = {'services': 0, 'configuration_values': 0}, options;

  ac = new Account({'_key': acKey});
  ctx = new DbOperationContext(ac, 'txn-stats');
  options = {'batchSize': 500, 'rectify': false};

  async.series([
    function getAllServices(callback) {
      callback = logAndIgnoreErrorAndIncreaseCounter(acKey, 'services', result, callback);
      serviceOps.getAll(ctx, options, callback);
    },

    function getAllConfigurationValues(callback) {
      callback = logAndIgnoreErrorAndIncreaseCounter(acKey, 'configuration_values', result, callback);
      configurationOps.getAll(ctx, options, callback);
    }
  ],

  function(err) {
    callback(err, result);
  });
}

function main() {
  async.waterfall([
    initialize,
    accountOps.getAllAccountIds.bind(null, {}),

    function processAccountsUsage(acIds, callback) {
      var totals = {'accounts': acIds.length, 'services': 0, 'configuration_values': 0};

      async.forEachLimit(acIds, CONCURRENCY, function(acId, callback) {
        processAccount(acId, function(err, result) {
          var key, count;

          if (err) {
            callback();
            return;
          }

          for (key in result) {
            if (totals.hasOwnProperty(key)) {
              count = result[key];
              totals[key] += count;
            }
          }

          callback();
        });
      },

      function(err) {
        callback(err, totals);
      });
    },

    function sendUsageToStatsd(totals, callback) {
      var key, count;

      for (key in totals) {
        if (totals.hasOwnProperty(key)) {
          count = totals[key];
          log.infof('Found ${count} ${type}', {'count': count, 'type': key});
          instruments.setGauge('usage.' + key, count);
        }
      }

      callback(null, totals);
    },

    function sendEmailStats(totals, callback) {
      if (!argv['send-email']) {
        callback();
        return;
      }

      var subject = 'Daily usage stats',
          body = sprintf('Accounts: %(accounts)s\n' +
                 'Services: %(services)s\nConfiguration Values %(configuration_values)s', totals),
          target = argv.target;

      email.sendEmail(target, subject, body, {}, callback);
    }
  ],

  function(err) {
    if (err) {
      log.error('Error while running job', {'err': err});
      process.exit(1);
    }

    setTimeout(process.exit.bind(null, 0), 2000);
  });
}

main();
