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

var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;

var common = require('../common');
var client = common.getClient('joe3');

exports.setUp = common.setUp;
exports.tearDown = common.tearDown;

exports['test_events_listing'] = function(test, assert) {
  async.waterfall([
    function testListEmpty(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 0);
        callback();
      });
    },

    function addInitialEvent(callback) {
      client.configuration.set('my-value-1', 'test value 123456', function(err, data) {
        assert.ifError(err);
        callback();
      });
    },

    function testInvalidSinceToken(callback) {
      client.events.list(0, {}, function(err, data, nextMarker) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.details, /Invalid UUID/);
        callback();
      });
    },

    function addSecondEvent(callback) {
      client.configuration.set('my-value-2', 'ponies', callback);
    },

    function addThirdEvent(callback) {
      client.configuration.set('my-value-3', 'even more ponies', callback);
    },

    function listEventsWithInvalidType(callback) {
      var options = {'queryString': {'type': 'invalid'}};

      client.events.list(null, options, function(err) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.details, /Invalid type: invalid/);
        callback();
      });
    },

    function listEventsWithInvalidTypeArray(callback) {
      var options = {'queryString': {'type': ['invalid1', 'invalid2']}};

      client.events.list(null, options, function(err) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.details, /Invalid type: invalid/);
        callback();
      });
    },

    function listEventsWithValidType1(callback) {
      var options = {'queryString': {'type': 'configuration_value.remove'}};

      client.events.list(null, options, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 0);
        callback();
      });
    },

    function listEventsWithValidType2(callback) {
      var options = {'queryString': {'type': 'configuration_value.update'}};

      client.events.list(null, options, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 3);
        callback(null, data[2].id);
      });
    },

    function listEventsWithValidTypeAndLimit(lastId, callback) {
      var options = {'queryString': {'type': 'configuration_value.update'}, 'limit': 1};

      client.events.list(null, options, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        callback(null, lastId);
      });
    },

    function listEventsWithValidTypeAndLimit(lastId, callback) {
      var options = {'queryString': {'type': 'configuration_value.update'}, 'limit': 50};

      client.events.list(lastId, options, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        callback();
      });
    },

    function listEvents(callback) {
      client.events.list(null, {}, callback);
    },

    function testLastSinceToken(data, nextMarker, callback) {
      assert.equal(data.length, 3);
      var marker = data.pop().id;
      client.events.list(marker, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        callback();
      });
    },

    function listEvents(callback) {
      client.events.list(null, {}, callback);
    },

    function testMiddleSinceToken(data, nextMarker, callback) {
      var marker = data[1].id;
      client.events.list(marker, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 2);
        callback();
      });
    },

    function testTimestampGreaterThanNow(callback) {
      var futureTs = new Date().getTime() + 1000,
          from = highUUIDFromTimestamp(futureTs).toString();

      client.events.list(from, {}, function(err, data, lastMarker) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.details, /from parameter must be smaller than the current time/);
        callback();
      });
    },

    function testTimestampSmallerThanAcCreationdate(callback) {
      var pastTs = new Date().getTime() - 20000,
          from = highUUIDFromTimestamp(pastTs).toString();

      client.events.list(from, {}, function(err, data, lastMarker) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.details, /from parameter must be greater than or equal to the account creation date/);
        callback();
      });
    },

    function assertEmittedEvents(callback) {
      common.waitForEmittedEvents(client.events, 500, 800, function(err, events) {
        assert.equal(events['configuration_value.update'].length, 3);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_events_heartbeating_no_heartbeat_timeout'] = function(test, assert) {
  var serviceTimeout = 3, names, payloads, serviceId, initialToken;

  names = ['ord1-messenger1-messenger0', 'ord1-messenger1-messenger1'];
  payloads = [
    {
      'tags': ['messenger', 'fb303', 'stats'],
      'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
    },
    {
      'tags': ['messenger', 'fb303', 'stats'],
      'metadata': {'region': 'dfw', 'port': '5758', 'ip': '127.0.0.2'}
    },
  ];

  async.waterfall([
    function testCreateServices(callback) {
      async.forEachSeries([0, 1], function(i, callback) {
        var name, payload;

        name = names[i];
        payload = payloads[i];

        client.services.create(name, serviceTimeout, payload, function(err, data) {
          assert.ifError(err);
          initialToken = data.token;
          callback();
        });
      }, callback);
    },

    function listEvents(callback) {
      // There should be 2 service.join events
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ok(data.length, 2);

        data.forEach(function(item) {
          assert.equal(item.type, 'service.join');
          assert.equal(item.payload.service_id, serviceId);
        });

        callback();
      });
    },

    function wait(callback) {
      setTimeout(callback, (serviceTimeout + 1) * 1000);
    },

    function listEventsShouldIncludeNewTimedOutEvents(callback) {
      var items = new Array(150).join('a').split('a');
      // We list events multiple times in parallel. This should trigger a
      // rectification process in the API.
      // Events for the same marker should only be inserted once.

      async.forEach(items, function(_, callback) {
        // There should be 2 service.join events + 2 new service.timeout events
        client.events.list(null, {}, function(err, data, nextMarker) {
          var i;

          assert.ifError(err);
          assert.equal(data.length, 2 + 2);

          assert.equal(data[0].type, 'service.join');
          assert.equal(data[1].type, 'service.join');

          for (i = 2; i < (names.length + 2); i++) {
            assert.equal(data[i].type, 'service.timeout');
            assert.equal(data[i].payload.id, names[i - 2]);
          }

          callback();
        });
      }, callback);
    },

    function wait(callback) {
      setTimeout(callback, 500);
    },

    function listEventsShouldIncludeNewTimedOutEvents(callback) {
      // There should be 2 service.join events + 2 new service.timeout events
      client.events.list(null, {}, function(err, data, nextMarker) {
        var i;

        assert.ifError(err);
        assert.equal(data.length, 2 + 2);

        assert.equal(data[0].type, 'service.join');
        assert.equal(data[1].type, 'service.join');

        for (i = 2; i < (names.length + 2); i++) {
          assert.equal(data[i].type, 'service.timeout');
          assert.equal(data[i].payload.id, names[i - 2]);
        }

        callback(null, data[1].id, data[2].id);
      });
    },

    function listEventsIncludingMarkerAndLimit(secondId, thirdId, callback) {
      client.events.list(secondId, {'limit': 1}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        assert.equal(data[0].id, secondId);

        callback(null, thirdId);
      });
    },

    function listEventsIncludingLastMarker(lastId, callback) {
      client.events.list(lastId, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 2);
        assert.equal(data[0].id, lastId);

        callback();
      });
    },

    function testHearbeatingDeadServiceShouldReturnError(callback) {
      client.services.heartbeat(serviceId, initialToken, function(err, data) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        callback();
      });
    },

    function assertEmittedEvents(callback) {
      common.waitForEmittedEvents(client.events, 500, 800, function(err, events) {
        assert.equal(events['service.join'].length, 2);
        assert.equal(events['service.timeout'].length, 2);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_remove_service_generates_an_event'] = function(test, assert) {
  var serviceId = 'ord1-messenger1-messenger-removed1',
      heartbeatTimeout = 30,
      servicePayload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

  async.series([
    function testListEmpty(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 0);
        callback();
      });
    },

    function testCreateService(callback) {
      client.services.create(serviceId, heartbeatTimeout, servicePayload, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testListEventsServiceJoinEventHasBeenInserted(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        assert.equal(data[0].type, 'service.join');
        assert.equal(data[0].payload.id, serviceId);
        assert.equal(data[0].payload.heartbeat_timeout, heartbeatTimeout);
        assert.deepEqual(data[0].payload.tags, servicePayload.tags);
        assert.deepEqual(data[0].payload.metadata, servicePayload.metadata);
        callback();
      });
    },

    function testRemoveService(callback) {
      client.services.remove(serviceId, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testListEventsServiceRemoveEventHasBeenInserted(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 2);
        assert.ok(data[1].timestamp > (Date.now() - 4000));
        assert.equal(data[1].type, 'service.remove');
        assert.equal(data[1].payload.id, serviceId);
        assert.equal(data[1].payload.heartbeat_timeout, heartbeatTimeout);
        assert.deepEqual(data[1].payload.tags, servicePayload.tags);
        assert.deepEqual(data[1].payload.metadata, servicePayload.metadata);
        callback();
      });
    },

    function assertEmittedEvents(callback) {
      common.waitForEmittedEvents(client.events, 500, 800, function(err, events) {
        assert.equal(events['service.join'].length, 1);
        assert.equal(events['service.remove'].length, 1);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
