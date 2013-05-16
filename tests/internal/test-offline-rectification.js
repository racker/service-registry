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
var common = require('../common');
var apiInit = require('../../lib/init').initialize;
var Event = require('../../lib/db/models/event').Event;
var serviceOps = require('../../lib/db/ops/service');
var account = require('../../lib/db/ops/account');
var cassShutdown = require('cassandra-orm/lib/orm/utils').shutdown;
var zkUtil = require('zookeeper-client/lib/util');
var instruments = require('rackspace-shared-utils/lib/instruments');
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;
var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;
var context = require('../../lib/db/context');
var getSome = require('../../lib/db/ops/utils').getSome;
var rectifierService = require('../../lib/rectifier/server');
var activity = require('../../lib/db/ops/activity');
var settings = require('../../lib/util/settings');

exports.initialize = function(test, assert) {
  async.waterfall([
    common.initializeCassandra,
    common.truncateColumnFamilies,
    apiInit
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

// we can't set this as the teardown because it interferes with what gets started in apiInit. So we wait until the end.
exports.finalize = function(test, assert) {
  async.waterfall([
    cassShutdown,
    zkUtil.shutdown,
    instruments.shutdown
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports.setUp = function(test, assert) {
  async.waterfall([
    common.initializeCassandra,
    common.truncateColumnFamilies
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

function sleep(ms) {
  return function(callback) {
    setTimeout(callback, ms);
  };
}

// todo: need to move some things into common asserts.

function expectNoError(test, assert, err) {
  assert.ifError(err);
  test.finish();
}

function assertEventCount(expected, ctx, assert, callback) {
  getSome(Event)(ctx, ctx.account.getKey(), false, lowUUIDFromTimestamp(1).toString(), highUUIDFromTimestamp(Date.now()).toString(), {usePaginationParams: true}, function(err, results) {
    assert.ifError(err);
    assert.strictEqual(expected, results.length);
    callback(null);
  });
}

exports['test_offline_rectification'] = function(test, assert) {
  var ctx = context.create(null, 'offline_rectification', false),
      key = 'acTestOffl',
      serviceParams = {
        'heartbeat_timeout': 1,
        'key': 'name of service',
        'tags': ['tags', 'here'],
        'metadata': { version: 'ou812', region: 'dfw', port: '1234', ip: '127.0.0.1' }
      }, rectifier;

  ctx.tracing = {
    serverRecvTrace: {
      child: function(str) {
        return {
          setEndpoint: function(endpoint) {},
          record: function(annotation) {}
        };
      }
    }
  };

  rectifier = new rectifierService.Rectifier();

  async.waterfall([
    function createAccount(callback) {
      account.create(ctx, {_key: key}, function(err, acct) {
        assert.ifError(err);
        ctx.setAccount(acct);
        callback(null);
      });
    },

    function checkForNoActivity(callback) {
      activity.getLast(ctx, key, function(err, timestamp) {
        assert.ifError(err);
        assert.strictEqual(0, timestamp.getTime());
        callback(null);
      });
    },

    function createService(callback) {
      serviceOps.create(ctx, serviceParams, function(err, service) {
        assert.ifError(err);
        callback(null);
      });
    },

    // make sure to wait for the default grace millis.
    sleep(2000 + settings.RECTIFIER_GRACE_MILLIS),

    // account activity should have posted within 2 seconds.
    function checkForSomeActivity(callback) {
      activity.getLast(ctx, key, function(err, timestamp) {
        assert.ifError(err);
        assert.ok(timestamp.getTime() !== 0);
        callback(null);
      });
    },

    // test with the actual code that will be used by the service.
    rectifier.rectifyAccount.bind(rectifier, key),

    // There should be 2 events (1 service.join and 1 service.timeout)
    assertEventCount.bind(null, 2, ctx, assert)
  ], expectNoError.bind(null, test, assert));
};

