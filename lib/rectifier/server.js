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

var async = require('async');
var log = require('logmagic').local('rectifier');
var generateTxnId = require('rackspace-shared-middleware/lib/middleware/transaction_id').generateTxnId;
var misc = require('rackspace-shared-utils/lib/misc');

var settings = require('../util/settings');
var util = require('./util');
var rectifyServices = require('../db/ops/event').rectifyServices;
var Account = require('../db/models/account').Account;
var accountOps = require('../db/ops/account');
var errors = require('../util/errors');
var context = require('../db/context');
var activity = require('../db/ops/activity');

var apiInit = require('../../lib/init').initialize;

var VERSION = 'OU812';
var getTxnId = generateTxnId.bind(null, VERSION);


function Rectifier() {
  this.shards = [];
}

/**
 * Does rectification for all accounts that fall under its shards.
 * @param Function callback expects (err). Any error is critical to the rectification process.
 */
Rectifier.prototype.rectify = function(callback) {
  var self = this;

  async.waterfall([
    function getAccounts(callback) {
      exports.getAccountsForShards(self.shards, callback);
    },

    function rectifyAccounts(acs, callback) {
      var concurrency = settings.RECTIFIER_CONCURRENCY;

      async.forEachLimit(util.shuffle(acs), concurrency, self.rectifyAccount.bind(self), callback);
    }
  ], callback);
};

/**
 * Does rectification for all accounts for a particular shard.
 * @param Integer shard which shard to rectify.
 * @param Function callback expects (err). Any error is critical to the rectification process.
 */
Rectifier.prototype.rectifyShard = function(shard, callback) {
  var self = this;
  log.debugf('Rectifying shard: ${shard}', {'shard': shard});

  async.waterfall([
    exports.getAccountsForShards.bind(null, [shard]),
    function rectifyAccounts(accounts, callback) {
      var concurrency = settings.RECTIFIER_CONCURRENCY;

      async.forEachLimit(util.shuffle(accounts), concurrency, self.rectifyAccount.bind(self), callback);
    }
  ], callback);
};

/**
 * Does rectification on a single account.
 * @param String accountId account that will be rectified.
 * @param Function callback expects (err). Any error is critical to the rectification process.
 */
Rectifier.prototype.rectifyAccount = function(accountId, callback) {
  var ctx = new context.DbOperationContext(null, getTxnId(), {});
  log.debugf('Rectifying account ${acKey}', {'acKey': accountId});

  async.waterfall([
    function loadAccount(callback) {
      // Save a query, use mocked account.
      var ac = new Account({'_key': accountId});
      ctx.setAccount(ac);
      callback();
    },

    rectifyServices.bind(null, ctx, { graceMillis: settings.RECTIFIER_GRACE_MILLIS }, callback)
  ],

  function(err) {
    if (err) {
      if (err instanceof errors.ObjectDoesNotExistError) {
        // Non fatal
        log.error(err.toString(), {'err': err});
        callback();
        return;
      }

      // trap errors here. determine if they warrant killing the process.
      // for now, they all do.
      log.error('Problem rectifying. ', {'acKey': accountId, 'err': err});
      callback(err);
      return;
    }

    log.debugf('Account ${acKey} has been rectified', {'acKey': accountId});
    callback();
  });
};

function getIdFromAccount(accountInfo) {
  return accountInfo.accountId;
}

/**
 * Gets the accounts for the provided shards.
 * @param {Array.{Number}} shards shards to lookup.
 * @param {Function} callback expects(err, array of account ids).
 */
exports.getAccountsForShards = function(shards, callback) {
  var ctx = new context.DbOperationContext(null, getTxnId(), {}),
      now = Date.now(),
      convictionThreshold = settings.RECTIFY_CONVICTION_THRESHOLD;

  activity.getAllAccountsForShards(ctx, shards, function(err, acs) {
    var filteredAccounts;

    if (err) {
      callback(err);
      return;
    }

    filteredAccounts = acs.filter(function filterOldAccounts(info) {
      return ((now - info.timestamp.getTime()) < convictionThreshold);
    });

    filteredAccounts = filteredAccounts.map(function getIdFromAccount(info) {
      return info.accountId;
    });

    callback(null, filteredAccounts);
  });
};

/**
 * Gets the accounts for the provided shard.
 * @param {Number} shard shard to lookup.
 * @param {Function} callback expects(err, array of account ids).
 */
exports.getAccountsForShard = function(shard, callback) {
  exports.getAccountsForShards([shard], callback);
};

/**
 * starts the service.
 */
exports.run = function() {
  var rectifier = new Rectifier();

  process.on('SIGHUP', function() {
    log.info('Reloading rectifier configuration');
    settings.reload();
  });

  log.info('Rectifier Started');

  async.waterfall([
    apiInit,

    async.whilst.bind(null,
      function() {
        return true;
      },

      function(callback) {
        rectifier.shards = util.parseShards(settings.RECTIFICATION_SHARDS);
        log.info('Kicking off full rectification', {'shards': settings.RECTIFICATION_SHARDS});

        rectifier.rectify(function(err) {
          var timeout = (err) ? 0 : (settings.RECTIFIER_SLEEP || 0);

          // Add some jitter to positive sleep interval
          if (timeout > 0) {
            timeout = timeout + (misc.getRandomInt(1, 5) * 1000);
            log.debugf('Scheduling next rectification for ${delay}ms in the future', {'delay': timeout});
          }

          setTimeout(callback.bind(null, err), timeout);
        });
      }
    )
  ],

  function(err) {
    // error means shut down. anything else gets dealt with during rectify.
    if (err) {
      log.error('Critical error during rectify', {error: err});
      process.exit(err.code ? err.code : -1);
    }

    log.info('Rectifier stopped');
    process.exit(0);
  });
};

exports.Rectifier = Rectifier;
