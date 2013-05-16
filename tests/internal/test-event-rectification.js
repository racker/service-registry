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
var getOne = require('../../lib/db/ops/utils').getOne;
var Metadata = require('../../lib/db/models/metadata').Metadata;
var Event = require('../../lib/db/models/event').Event;
var account = require('../../lib/db/ops/account');
var metadata = require('../../lib/db/ops/metadata');
var context = require('../../lib/db/context');
var cassCommon = require('../common');
var cassShutdown = require('cassandra-orm/lib/orm/utils').shutdown;
var apiInit = require('../../lib/init').initialize;
var serviceOps = require('../../lib/db/ops/service');
var eventOps = require('../../lib/db/ops/event');
var zkUtil = require('zookeeper-client/lib/util');
var instruments = require('rackspace-shared-utils/lib/instruments');
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;
var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;
var getSome = require('../../lib/db/ops/utils').getSome;

function expectNoError(test, assert) {
  return function(err) {
    assert.ifError(err);
    test.finish();
  };
}

exports.initialize = function(test, assert) {
  async.waterfall([
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

function sleep(ms) {
  return function(callback) {
    setTimeout(callback, ms);
  };
}

function assertEventCount(expected, ctx, assert, callback) {
  getSome(Event)(ctx, ctx.account.getKey(), false, lowUUIDFromTimestamp(0).toString(), highUUIDFromTimestamp(Date.now()).toString(), {usePaginationParams: true}, function(err, results) {
    assert.ifError(err);
    assert.strictEqual(expected, results.length);
    callback(null);
  });
}

exports['test_incremental_rectification'] = function(test, assert) {
  var ctx = context.create(null, 'event_life_cycle', false),
      key = 'acTestEven',
      serviceParams = {
        'heartbeat_timeout': 1,
        'key': 'name of service',
        'tags': ['tags', 'here'],
        'metadata': { version: 'ou812', region: 'dfw', port: '1234', ip: '127.0.0.1' }
      };

  // mock tracing.
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

  var baton = {
    lastRectA: null,
    lastRectB: null
  };

  async.waterfall([
    function createAccount(callback) {
      account.create(ctx, {_key: key}, function(err, acct) {
        assert.ifError(err);
        assert.strictEqual(key, acct.getKey());
        ctx.account = acct;
        callback(null);
      });
    },

    function verifyMetaWasWritten(callback) {
      metadata.getOne(ctx, key, function(err, meta) {
        assert.ifError(err);
        assert.strictEqual(key, meta.getKey());
        assert.ok(meta.last_rectification);
        baton.lastRectA = meta.last_rectification;
        callback(null);
      });
    },

    assertEventCount.bind(null, 0, ctx, assert),

    function createService(callback) {
      serviceOps.create(ctx, serviceParams, function(err, service, hbm) {
        assert.ifError(err);
        callback(null);
      });
    },

    eventOps.rectifyServices.bind(null, ctx, {}),

    // There should be 1 service.join event
    assertEventCount.bind(null, 1, ctx, assert),

    sleep(2000),

    // check again to make sure the process of timing out without
    // rectification doesn't generate new events.
    assertEventCount.bind(null, 1, ctx, assert),

    // after rectification, we should see an additional event.
    eventOps.rectifyServices.bind(null, ctx, {}),
    assertEventCount.bind(null, 2, ctx, assert),

    function verifyLastRectificationWasUpdated(callback) {
      metadata.getOne(ctx, key, function(err, meta) {
        assert.ifError(err);
        assert.strictEqual(key, meta.getKey());
        assert.ok(meta.last_rectification);
        baton.lastRectB = meta.last_rectification;
        callback(null);
      });
    }
  ], expectNoError(test, assert));
};
