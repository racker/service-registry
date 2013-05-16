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

var cassCommon = require('../common');
var cassShutdown = require('cassandra-orm/lib/orm/utils').shutdown;
var apiInit = require('../../lib/init').initialize;
var zkUtil = require('zookeeper-client/lib/util');
var instruments = require('rackspace-shared-utils/lib/instruments');
var context = require('../../lib/db/context');
var serviceOps = require('../../lib/db/ops/service');
var account = require('../../lib/db/ops/account');

var settings = require('../../lib/util/settings');
var activity = require('../../lib/db/ops/activity');
var server = require('../../lib/rectifier/server');

var testCtx = {tracing: false};
var SHARDS_TO_47 = 'acu9JUSvo0,acT083TAbI,ac056TCnRn,ac8tSVj5zq,acvGOyr6Pd,acMtGPTrg5,acRRMixEaI,acp6MY5XEQ,acbgvtGDQQ,ac7KHvfYVq,acIpw1RaGZ,ac6ShZHRBD,ac8lAoIjOw,acWhYdFUX6,ac9YHmfUYM,aclqfbP2c2'.split(',');
var SHARDS_TO_48 = 'acYgmgPeqW,ac9i6MJI7p,acLOqS14LO,acmBCuti1a,ac9CpwJmxZ,ac44E7sRID,acccJQvhPq,acAcBdlJLf,acrMbTX3kq,acWBv42wvE,acsngZHMHS,acpOoPnujm,acDPl8NEDM,acawXV5YTs,aciYP4n50r,acS6EueRLA'.split(',');

function expectNoError(test, assert) {
  return function(err) {
    assert.ifError(err);
    test.finish();
  };
}

function sleep(ms) {
  return function(callback) {
    setTimeout(callback, ms);
  };
}

exports.initialize = function(test, assert) {
  async.waterfall([
    function reloadSettings(callback) {
      settings.reload();
      callback();
    },
    cassCommon.initializeCassandra,
    cassCommon.truncateColumnFamilies,
    apiInit
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

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
    cassCommon.initializeCassandra,
    cassCommon.truncateColumnFamilies
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

function assertActivityTimestamp(ctx, accountId, value, assert, callback) {
  activity.getLast(ctx, accountId, function(err, timestamp) {
    assert.ifError(err);
    assert.strictEqual(value, timestamp.getTime());
    callback(null);
  });
}

exports['test_simple_read_write'] = function(test, assert) {
  var accountId = 'acSimpleReadWrite',
      updatedAt = 5;
  async.waterfall([
    activity.update.bind(null, testCtx, accountId, updatedAt),
    assertActivityTimestamp.bind(null, testCtx, accountId, updatedAt, assert)
  ],
  expectNoError(test, assert));
};

exports['test_late_updates_do_not_overwrite'] = function(test, assert) {
  var accountId = 'acLateWrite';
  async.waterfall([
    activity.update.bind(null, testCtx, accountId, 10),
    assertActivityTimestamp.bind(null, testCtx, accountId, 10, assert),
    activity.update.bind(null, testCtx, accountId, 15),
    assertActivityTimestamp.bind(null, testCtx, accountId, 15, assert),
    activity.update.bind(null, testCtx, accountId, 13),
    assertActivityTimestamp.bind(null, testCtx, accountId, 15, assert),
    activity.update.bind(null, testCtx, accountId, 16),
    assertActivityTimestamp.bind(null, testCtx, accountId, 16, assert)
  ],
  expectNoError(test, assert));
};

exports['test_non_existent_account'] = function(test, assert) {
  assertActivityTimestamp(testCtx, 'acDeleted', 0, assert, function() {
    test.finish();
  });
};

exports['test_account_deletion'] = function(test, assert) {
  var accountId = 'acDeleted';
  async.waterfall([
    assertActivityTimestamp.bind(null, testCtx, accountId, 0, assert),
    activity.update.bind(null, testCtx, accountId, 10),
    assertActivityTimestamp.bind(null, testCtx, accountId, 10, assert),
    activity.hardRemove.bind(null, testCtx, accountId),
    //should force it back to 0 since it is gone.
    assertActivityTimestamp.bind(null, testCtx, accountId, 0, assert)
  ],
  expectNoError(test, assert));
};

exports['test_heartbeat_updates_activity'] = function(test, assert) {
  // ensure that service operations update account activity.
  var ctx = context.create(null, 'offline_rectification', false),
      key = 'acTestHbAc',
      serviceParams = {
        'heartbeat_timeout': 1,
        'key': 'name of service',
        'tags': ['tags', 'here'],
        'metadata': { version: 'ou812', region: 'dfw', port: '1234', ip: '127.0.0.1' }
      },
      initialToken = null;

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
      serviceOps.create(ctx, serviceParams, function(err, service, hbm) {
        assert.ifError(err);
        initialToken = hbm.getKey();
        callback(null);
      });
    },

    sleep(100),

    // account activity should have posted within 2 seconds.
    function checkForSomeActivity(callback) {
      activity.getLast(ctx, key, function(err, timestamp) {
        assert.ifError(err);
        assert.ok(timestamp.getTime() !== 0);
        serviceParams.metadata.lastHeartbeat = timestamp.getTime();
        callback(null);
      });
    },

    function doHeartbeat(callback) {
      serviceOps.heartbeat(ctx, serviceParams.key, initialToken, function(err, res) {
        assert.ifError(err);
        callback(null);
      });
    },

    function ensureLastActivityWasUpdated(callback) {
      activity.getLast(ctx, key, function(err, timestamp) {
        assert.ifError(err);
        assert.ok(timestamp.getTime() !== serviceParams.metadata.lastHeartbeat);
        serviceParams.metadata.lastHeartbeat = timestamp.getTime();
        callback(null);
      });
    }
  ], expectNoError(test, assert));
};

exports['test_get_all_and_sort_order'] = function(test, assert) {
  async.waterfall([
    // update activity for them all.
    async.forEach.bind(null, SHARDS_TO_47, function(accountId, callback) {
      activity.update(testCtx, accountId, 5, callback);
    }),

    async.forEach.bind(null, SHARDS_TO_48, function(accountId, callback) {
      activity.update(testCtx, accountId, 5, callback);
    }),

    // now verify results.
    function getAllA(callback) {
      activity.getAllAccounts(testCtx, 47, function(err, timestamps) {
        assert.ifError(err);
        assert.strictEqual(SHARDS_TO_47.length, timestamps.length);
        assert.eql(SHARDS_TO_47.sort(), timestamps.map(function(obj) { return obj.accountId;}));
        callback(null);
      });
    },

    function getAllB(callback) {
      activity.getAllAccounts(testCtx, 48, function(err, timestamps) {
        assert.ifError(err);
        assert.strictEqual(SHARDS_TO_48.length, timestamps.length);
        assert.eql(SHARDS_TO_48.sort(), timestamps.map(function(obj) { return obj.accountId;}));
        callback(null);
      });
    }
  ],
  expectNoError(test, assert));
};

exports['test_get_accounts_for_shard_filters_by_age'] = function(test, assert) {
  async.waterfall([
    function assertArrayLength(callback) {
      assert.strictEqual(16, SHARDS_TO_47.length);
      callback(null);
    },

    async.forEach.bind(null, SHARDS_TO_47.slice(0, SHARDS_TO_47.length / 2), function(accountId, callback) {
      activity.update(testCtx, accountId, Date.now(), callback);
    }),

    sleep(2000),

    async.forEach.bind(null, SHARDS_TO_47.slice(SHARDS_TO_47.length / 2), function(accountId, callback) {
      activity.update(testCtx, accountId, Date.now(), callback);
    }),

    function shouldGetAll(callback) {
      server.getAccountsForShards([47], function(err, accounts) {
        assert.ifError(err);
        assert.strictEqual(SHARDS_TO_47.length, accounts.length);
        callback(null);
      });
    },

    function shouldGetHalf(callback) {
      settings.RECTIFY_CONVICTION_THRESHOLD = 1500;
      server.getAccountsForShard(47, function(err, accounts) {
        assert.ifError(err);
        assert.strictEqual(SHARDS_TO_47.length / 2, accounts.length);
        callback(null);
      });
    }
  ],
  expectNoError(test, assert));
};
