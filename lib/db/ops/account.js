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
var BatchInsert = require('cassandra-orm/lib/orm/batch_insert').BatchInsert;
var PaginatedObjectIterator = require('cassandra-orm/lib/orm/iterator').PaginatedObjectIterator;
var RowKeyIterator = require('cassandra-orm/lib/orm/iterator').RowKeyIterator;
var ColumnIterator = require('cassandra-orm/lib/orm/iterator').ColumnIterator;

var Account = require('../models/account').Account;
var Metadata = require('../models/metadata').Metadata;
var getOne = require('./utils').getOne;
var getAll = require('./utils').getAll;
var settings = require('../../util/settings');
var errors = require('../../util/errors');
var metadata = require('./metadata');

var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;

/**
 * Does what you think.
 * @param {DbOperationContext} ctx The context for this operation.
 * @param {String} key account key: acXXXXXXXX.
 * @param {Function} callback expects (err, Metadata).
 */
exports.getOne = function(ctx, key, callback) {
  getOne(Account)(ctx, key, key, {'includeChildren': false}, callback);
};

exports.getAll = function(ctx, callback) {
  var iter = new PaginatedObjectIterator(ctx, Account, { 'limit': 100000 }),
      result = [];

  iter.getSlice(true, null, null);
  iter.on('object', function(obj) {
    result.push(obj);
  });

  iter.on('error', callback);
  iter.on('end', function() {
    callback(null, result);
  });
};

/**
 * Retrieve a sorted list of all account ids. This requires about ceiling(n /
 * 100000) queries, plus an in-memory sort of n items, where n is the number of
 * accounts.
 *
 * Note: it is useful to sort these, so that when iterating them to access all
 * accounts the IO is splayed evenly across the cluster, instead of traversing
 * the cluster with the accounts in token order.
 *
 * @param {DbOperationContext} ctx The context for this operation.
 * @param {Function} callback A callback fired with (err, acctIds).
 */
exports.getAllAccountIds = function(ctx, callback) {
  var acctIds = [], iter = new RowKeyIterator(ctx, Account.meta.columnFamily);

  iter.getKeys();

  iter.on('key', function(key) {
    acctIds.push(key);
  });

  iter.on('end', function() {
    callback(null, acctIds.sort());
  });

  iter.on('error', callback);
};

/**
 * Retrieve usage for the specified resource.
 * @param {DbOperationContext} ctx db context.
 * @param {String} acKey Account key.
 * @param {String} resource Resource name.
 * @param {Function} callback expects(err, nt).
 */
exports.getUsageCountForResource = function(ctx, acKey, resource, callback) {
  var ci, result = null;

  ci = new ColumnIterator(ctx, settings.ACCOUNTING_CF, {});

  ci.on('error', function(err) {
    callback(err);
  });

  ci.on('column', function(nameValueTuple) {
    result = parseInt(nameValueTuple.value, 10);
  });

  ci.on('end', function() {
    callback(null, result);
  });

  ci.getSlice([acKey], {'starting': resource, 'ending': resource});
};

/**
 * Verifies that an account resource limit has not been reached.
 *
 * @param {DbOperationContext} ctx db context.
 * @param {String} resource Plural resource name (checks, alarms, entities,
 * etc).
 * @param {Function} callback A callback called with (err) if limit has been
 * reached.
 */
exports.checkLimit = function checkLimit(ctx, resource, callback) {
  var acKey = ctx.account.getKey();

  async.waterfall([
    exports.getUsageCountForResource.bind(null, ctx, acKey, resource),

    function verifyLimits(currentUsage, callback) {
      currentUsage = currentUsage || 0;
      var err,
          limit = ctx.account.limits[resource];

      if (currentUsage >= limit) {
        err = new errors.LimitReachedError(resource, limit);
      }

      callback(err);
    }
  ], callback);
};

exports.create = function(ctx, params, callback) {
  // save a metadata row while we are at it.
  var bi, ac, me;
  ac = new Account(params);
  me = new Metadata({_key: ac.getKey()});
  // set last_rectification to be two hours ago.
  me.last_rectification = lowUUIDFromTimestamp(Date.now() - 7200000).toString();
  bi = new BatchInsert(ctx, ac.getKey());
  bi.begin();
  bi.save(ac);
  bi.save(me);
  bi.commit(function(err) {
    callback(err, ac);
  });
};

exports.update = function(ctx, key, params, callback) {
  var bi = new BatchInsert(ctx, key);

  async.waterfall([
    exports.getOne.bind(null, ctx, key),

    function validate(ac, callback) {
      bi.begin();
      ac.mergeForUpdate(ctx, params, bi, callback);
    },

    function updateInDatabase(ac, callback) {
      bi.save(ac);
      bi.commit(function(err) {
        callback(err, ac);
      });
    }
  ], callback);
};

exports.remove = function(ctx, key, callback) {
  var bi = new BatchInsert(ctx, key);

  bi.begin();

  async.waterfall([
    // fetch and remove metadata first.
    metadata.getOne.bind(null, ctx,key),

    function removeMeta(me, callback) {
      bi.removeObject(me);
      callback(null);
    },

    exports.getOne.bind(null, ctx, key),

    function removeAcct(ac, callback) {
      bi.removeObject(ac);
      callback(null, ac);
    }
  ],

  function(err, ac) {
    if (err) {
      callback(err);
      return;
    }

    bi.commit(function(err) {
      callback(err, ac);
    });
  });
};
