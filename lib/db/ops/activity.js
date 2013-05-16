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

var log = require('logmagic').local('rectifier-activity');
var ormUtils = require('cassandra-orm/lib/orm/utils');

var computeShard = require('../../rectifier/util').computeShard;
var ColumnIterator = require('cassandra-orm/lib/orm/iterator').ColumnIterator;
var fireOnce = require('rackspace-shared-utils/lib/flow_control').fireOnce;

/*
    Why I didn't use the ORM:
    1. It would have been overkill. There are no composite columns in this model.
    2. It would have made things significantly harder. Getting everything converted into types that fit models.
 */


/**
 * Update activity for a given account. This method can work in 'fire and forget' format if the callback is left off.
 * @param {DbOperationContext} ctx the database context.
 * @param {String} accountId which account gets updated.
 * @param {Number} timestamp activity timestamp (in ms).
 * @param {?Function} callback optional callback expects(err).
 */
exports.update = function(ctx, accountId, timestamp, callback) {
  if (!callback) {
    callback = function() {};
  }

  var writeTimestamp = (timestamp * 1000), query, args;

  query = 'UPDATE account_activity USING TIMESTAMP ' + writeTimestamp + ' SET ?=? WHERE KEY=?';
  args = [accountId, timestamp, computeShard(accountId)];
  ormUtils.getConnPool().execute(ctx, query, args, function(err) {
    if (err) {
      log.errorf('Failed to update activity for ${acKey}', {'acKey': accountId, 'err': err});
    }
    else {
      log.debugf('Successfully updated activity for ${acKey}', {'acKey': accountId,
                                                                'timestamp': timestamp});
    }

    callback(err);
  });
};

/**
 * Get the last activity for a given account. accounts that do not exist return a zero timestamp (not an error).
 * @param {DbOperationContext} ctx the database context.
 * @param {String} accountId account to look up.
 * @param {Function} callback expects(err, Date).
 */
exports.getLast = function(ctx, accountId, callback) {
  var ci;
  // the hard way of doing: 'SELECT ? from account_activity WHERE KEY=?'
  ci = new ColumnIterator(ctx, 'account_activity', {
    'batchSize': 10,
    'dataPrefix': '',
    'readConsistency': 'ONE',
    'reverse': false
  });

  ci.getOneColumn(computeShard(accountId), accountId, function(err, col) {
    var result;

    if (err) {
      callback(err);
      return;
    }

    result = (col) ? col.value : new Date(0);
    callback(null, result);
  });
};

/**
 * Delete update informaton for an account. This is intended as part of account maintenance. Also works in the
 * fire-and-forget way update() does.
 * @param {DbOperationContext} ctx the database context.
 * @param {String} accountId account that is getting removed.
 * @param {?Function} callback optional callback expects(err).
 */
exports.hardRemove = function(ctx, accountId, callback) {
  if (!callback) {
    callback = function() {};
  }

  var query, args;

  query = 'DELETE ? FROM account_activity WHERE KEY=?';
  args = [accountId, computeShard(accountId)];

  ormUtils.getConnPool().execute(ctx, query, args, function(err) {
    callback(err);
  });
};

/**
 * Gets all update information for accounts in a shard (regardless of age).
 * @param {DbOperationContext} ctx the database context.
 * @param {Number} shard shard to lookup.
 * @param {Function} callback expects(err, [{accountId:String, timestamp:Date}]).
 */
exports.getAllAccounts = function(ctx, shard, callback) {
  exports.getAllAccountsForShards(ctx, [shard], callback);
};

/**
 * Gets all update information for accounts in all the provided shards (regardless of age).
 * @param {DbOperationContext} ctx the database context.
 * @param {Array.{Number}} shards shards to lookup.
 * @param {Function} callback expects(err, [{accountId:String, timestamp:Date}]).
 */
exports.getAllAccountsForShards = function(ctx, shards, callback) {
  var ci, result = [];

  callback = fireOnce(callback);

  ci = new ColumnIterator(ctx, 'account_activity', {
    batchSize: 500,
    dataPrefix: '',
    readConsistency: 'ONE',
    reverse: false
  });

  ci.on('error', function(err) {
    callback(err);
  });

  ci.on('column', function(col) {
    result.push({
      accountId: col.name,
      timestamp: col.value
    });
  });

  ci.on('end', function() {
    callback(null, result);
  });

  ci.getSlice(shards, {'starting': '', 'ending': ''});
};
