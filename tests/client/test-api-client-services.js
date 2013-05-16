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
var sprintf = require('sprintf').sprintf;

var common = require('../common');
var client = common.getClient('joe4');
var Service = require('../../lib/db/models/service').Service;
var serviceOps = require('../../lib/db/ops/service');
var Account = require('../../lib/db/models/account').Account;
var misc = require('../../lib/util/misc');
var randstr = require('rackspace-shared-utils/lib/misc').randstr;

exports.setUp = common.setUp;
exports.tearDown = common.tearDown;

exports['test_services_crud'] = function(test, assert) {
  async.waterfall([
    function testListEmpty(callback) {
      client.services.list(null, function(err, data, nextMarker) {
        assert.ifError(err);

        assert.equal(data.length, 0);
        callback();
      });
    },

    function testCreateServiceTooManyMetadataItems(callback) {
      var payload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {}
      }, i;

      for (i = 0; i < 21; i++) {
        payload.metadata['key' + i] = i.toString();
      }

      client.services.create('ord1-messenger1-messenger1', 30, payload, function(err) {
        assert.ok(err);
        assert.match(err.response.body.message, /metadata/);
        assert.match(err.response.body.details, /Object needs to have between 0 and 20 items/);

        callback();
      });
    },

    function testPrefixWithinIdDoesNotGetRemovedInLocationHeader(callback) {
      client.services._options.raw = true;
      client.services.create('srvfoobarsrvfoo', 30, {}, function(err, data) {
        assert.ifError(err);

        assert.equal(data.headers.location.split('/')[6], 'srvfoobarsrvfoo');
        client.services._options.raw = false;

        callback();
      });
    },

    function testGetInvalidIdProvided1(callback) {
      client.services.get('ab', function(err, data) {
        assert.ok(err);
        assert.match(err.response.body.message, /Invalid value for 'serviceId' query string parameter/);
        assert.equal(err.statusCode, 400);

        callback();
      });
    },

    function testUpdateInvalidIdProvided1(callback) {
      client.services.update('ab', {}, function(err, data) {
        assert.ok(err);
        assert.match(err.response.body.message, /Invalid value for 'serviceId' query string parameter/);
        assert.equal(err.statusCode, 400);

        callback();
      });
    },

    function testRemoveInvalidIdProvided1(callback) {
      client.services.update(new Array(100).join('b'), {}, function(err, data) {
        assert.ok(err);
        assert.match(err.response.body.message, /Invalid value for 'serviceId' query string parameter/);
        assert.equal(err.statusCode, 400);

        callback();
      });
    },

    function testCreateServiceWithDotInId(callback) {
      var payload = {
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

      client.services._options.raw = true;
      client.services.create('ord1-messenger1-messenger1.foo.bar', 30, payload, function(err, data) {
        assert.ifError(err);
        assert.equal(data.headers.location.split('/')[6], 'ord1-messenger1-messenger1.foo.bar');
        client.services._options.raw = false;

        callback();
      });
    },

    function testCreateService1(callback) {
      var payload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

      client.services.create('ord1-messenger1-messenger1', 30, payload, function(err) {
        assert.ifError(err);

        callback(null, payload);
      });
    },

    function testGetService1(payload, callback) {
      client.services.get('ord1-messenger1-messenger1', function(err, data) {
        assert.ifError(err);

        assert.equal(data.id, 'ord1-messenger1-messenger1');
        assert.equal(data.heartbeat_timeout, 30);
        assert.deepEqual(data.tags, payload.tags);
        assert.deepEqual(data.metadata, payload.metadata);

        callback();
      });
    },

    function testUpdateService1(callback) {
      var payload = {
        'heartbeat_timeout': 15
      };

      client.services.update('ord1-messenger1-messenger1', payload, function(err, id) {
        assert.ifError(err);
        assert.equal(id, 'ord1-messenger1-messenger1');
        callback();
      });
    },

    function testGetService1UpdateWasSuccessful(callback) {
      client.services.get('ord1-messenger1-messenger1', function(err, data) {
        assert.ifError(err);

        assert.equal(data.id, 'ord1-messenger1-messenger1');
        assert.equal(data.heartbeat_timeout, 15);
        callback();
      });
    },

    function testCreateService2(callback) {
      var payload = {
        'tags': ['api', 'fb303'],
        'metadata': {'region': 'dfw', 'port': '5111', 'ip': '127.0.0.2'}
      };

      client.services.create('ord1-api1-api0', 30, payload, function(err) {
        callback();
      });
    },

    function testCreateService3(callback) {
      var payload = {
        'tags': ['api', 'fb303'],
        'metadata': {'region': 'dfw', 'port': '5111', 'ip': '127.0.0.2'}
      };

      client.services.create('ord1-api1-api1', 30, payload, function(err) {
        assert.ifError(err);

        callback();
      });
    },

    function testCreateServiceWithAnExistingId(callback) {
      var payload = {
        'tags': ['api', 'fb303'],
        'metadata': {'region': 'dfw', 'port': '5111', 'ip': '127.0.0.2'}
      };

      client.services.create('ord1-api1-api1', 30, payload, function(err) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.equal(err.response.body.type, 'serviceWithThisIdExists');
        assert.match(err.response.body.message, /Service with id ord1-api1-api1 already exists/);

        callback();
      });
    },

    function createServiceIdTooShort(callback) {
      client.services.create('a', 30, {}, function(err) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.message, /Validation error for key 'id'/);
        assert.match(err.response.body.details, /String is not in range \(3\.\.65\)/);

        callback();
      });
    },

    function createServiceIdTooLong(callback) {
      var str = new Array(67).join('a');
      client.services.create(str, 30, {}, function(err) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.message, /Validation error for key 'id'/);
        assert.match(err.response.body.details, /String is not in range \(3\.\.65\)/);

        callback();
      });
    },

    function testListServices(callback) {
      client.services.list({}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 5);

        callback(null, data[1].id);
      });
    },

    function testListServicesWithMarker(secondId, callback) {
      client.services.list({'marker': secondId}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 4);

        callback();
      });
    },

    function testListServicesForTagEmptyTag(callback) {
      client.services.listForTag('', {}, function(err, data) {
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.message, /Invalid value for 'tag' query string parameter/);

        callback();
      });
    },

    function testListServicesForTagInvalidTag1(callback) {
      client.services.listForTag('\'', {}, function(err, data) {
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.message, /Invalid value for 'tag' query string parameter/);

        callback();
      });
    },

    function testListServicesForTagInvalidTag2(callback) {
      client.services.listForTag('<youremail>\r\nCc:<youremail>', {}, function(err, data) {
        assert.equal(err.statusCode, 400);
        assert.match(err.response.body.message, /Invalid value for 'tag' query string parameter/);

        callback();
      });
    },

    function testListServicesForTag1(callback) {
      client.services.listForTag('messenger', {}, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 1);

        callback();
      });
    },

    function testListServicesForTag2(callback) {
      client.services.listForTag('fb303', {}, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 3);

        callback(null, data[1].id);
      });
    },

    function testListServicesForTag2WithMarker(secondId, callback) {
      client.services.listForTag('fb303', {'marker': secondId}, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 2);

        callback(null, secondId);
      });
    },

    function testListServicesForTag2WithMarkerAndLimit(secondId, callback) {
      client.services.listForTag('fb303', {'marker': secondId, 'limit': 1}, function(err, data) {
        assert.ifError(err);
        assert.equal(data.length, 1);

        callback();
      });
    },

    function testRemoveService3(callback) {
      client.services.remove('ord1-api1-api1', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testGetService3DoesNotExist(callback) {
      client.services.get('ord1-api1-api1', function(err, data) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        callback();
      });
    },

    function testUpdateService(callback) {
      var payload = {'tags': [], 'metadata': {'a': 'b'}};
      client.services.update('ord1-api1-api0', payload, function(err, id) {
        assert.ifError(err);
        assert.equal(id, 'ord1-api1-api0');
        callback();
      });
    },

    function testGetServiceUpdateWorked(callback) {
      client.services.get('ord1-api1-api0', function(err, data) {
        assert.ifError(err);
        assert.deepEqual(data.metadata, {'a': 'b'});
        assert.deepEqual(data.tags, []);
        callback();
      });
    },

    function testCreateMultipleServicesWithSameNameInParallel(callback) {
      var payload, count = 10, errors = [];

      payload = {
        'tags': ['api', 'fb303'],
        'metadata': {'region': 'dfw', 'port': '5111', 'ip': '127.0.0.2'}
      };

      async.forEach(new Array(count).join('.').split('.'), function(_, callback) {
        client.services.create('some-service-1', 30, payload, function(err) {
          if (err) {
            assert.equal(err.statusCode, 400);
            assert.match(err.response.body.message, /Service with id some-service-1 already exists/);
            errors.push(err);
          }

          callback();
        });
      },

      function(err) {
        assert.ifError(err);

        // Only 1 service should have been sucesfully created.
        assert.equal(errors.length, (count - 1));
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_create_two_services_same_id_prefix'] = function(test, assert) {
  async.waterfall([
    function testCreateService1(callback) {
      var payload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

      client.services.create('ord1-messenger1-messengerA', 30, payload, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testCreateService2(callback) {
      var payload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

      client.services.create('ord1-messenger1-messengerAA', 30, payload, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testGetService1(callback) {
      client.services.get('ord1-messenger1-messengerA', function(err, data) {
        assert.ifError(err);
        assert.ok(data);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_register_service_quick_death'] = function(test, assert) {
  async.waterfall([
    function testRegisterService1(callback) {
      var payload = {
        'tags': ['messenger', 'fb303', 'stats'],
        'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
      };

      client.services.register('ord1-messenger1-messengerA', 3, payload, {}, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function registerService2(callback) {
      // Here we assume service has died and try to re-register with the same
      // id. Function will wait for service 1 to time out and service with the
      // same id to be removed before re-registering.
      var payload = {
        'tags': ['srv2']
      };

      client.services.register('ord1-messenger1-messengerA', 10, payload, {}, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testGetService1(callback) {
      client.services.get('ord1-messenger1-messengerA', function(err, data) {
        assert.ifError(err);
        assert.ok(data);
        assert.deepEqual(data.tags, ['srv2']);
        callback();
      });
    },

    function testErrPrefixIsStrippedFromObjectKey(callback) {
      client.services.get('nonExistentService', function(err, data) {
        assert.ok(err);
        assert.equal(err.response.body.details,
                     'Object "Service" with key "nonExistentService" does not exist');
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_service_heartbeating'] = function(test, assert) {
  var srvIds = [], initialTokens = [], srvHeartbeatTs = {};

  async.series([
    function createServices(callback) {
      async.forEach([0, 1, 2], function(index, callback) {
        var id = 'my-service-' + index.toString();

        client.services.create(id ,30, {}, function(err, data, hb) {
          assert.ifError(err);
          assert.ok(data.hasOwnProperty('token'));

          srvIds.push(id);
          initialTokens.push(data.token);

          callback();
        });
      }, callback);
    },

    function testHeartbeatInvalidServiceId(callback) {
      client.services.heartbeat('srvDoesntExist', initialTokens[0], function(err, nextToken) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        assert.match(err.response.body.details, /Service/);
        callback();
      });
    },

    function testHeartbeatService11InvalidToken(callback) {
      client.services.heartbeat(srvIds[0], 'b5bfd330-db36-11e1-9b23-0800200c9a66', function(err, nextToken) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        assert.match(err.response.body.details, /HeartbeatMarker/);
        callback();
      });
    },

    function testHeartbeatServicesSucces(callback) {
      async.forEachSeries([0, 1, 2], function(index, callback) {
        var srvId = srvIds[index], initialToken = initialTokens[index];

        srvHeartbeatTs[srvId] = Date.now();
        client.services.heartbeat(srvId, initialToken, function(err, nextToken) {
          assert.ifError(err);
          assert.ok(nextToken && (nextToken !== initialToken));
          assert.equal(nextToken.length, 36);

          setTimeout(callback, 300);
        });
      }, callback);
    },

    function testGetServicesLastSeenHasBeenUpdated(callback) {
      async.forEach(srvIds, function(srvId, callback) {
        client.services.get(srvId, function(err, data) {
          assert.ifError(err);
          assert.ok(data.last_seen);
          assert.ok(data.last_seen > srvHeartbeatTs[srvId]);
          callback();
        });
      }, callback);
    },

    function testListServicesLastSeenHasBeenUpdate(callback) {
      client.services.list({}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, srvIds.length);

        data.forEach(function(srv) {
          assert.ok(srv.last_seen);
          assert.ok(srv.last_seen > srvHeartbeatTs[srv.id]);
        });

        callback();
      });
    }

  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_services_heartbeating_using_HeartBeater_and_list_services_rectification'] = function(test, assert) {
  var SERVICE_TIMEOUT = 3, serviceIds = [], hbs = [];

  async.waterfall([
    function createLowTimeoutServices(callback) {
      async.forEach([1, 2, 3], function(index, callback) {
        var id = 'service-' + index.toString();

        client.services.create(id, SERVICE_TIMEOUT, {}, function(err, data, hb) {
          assert.ifError(err);
          assert.ok(data.hasOwnProperty('token'));

          serviceIds.push(id);
          hbs.push(hb);

          callback();
        });
      }, callback);
    },

    function createHighTimeoutService(callback) {
      var id = 'service-high-timeout';

      client.services.create(id, 30, {}, function(err, data, hb) {
        assert.ifError(err);
        assert.ok(data.hasOwnProperty('token'));

        serviceIds.push(id);
        callback();
      });
    },

    function startHeartbeating(callback) {
      hbs.forEach(function(hb) {
        hb.start();
      });

      setTimeout(function() {
        hbs.forEach(function(hb) {
          hb.stop();
        });

        callback();
      }, 10 * 1000);
    },

    function verifyServicesAreStillAlive(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 4);

        data.forEach(function(item) {
          assert.equal(item.type, 'service.join');
        });

        callback();
      });
    },

    function waitForLowTimeoutServicesToTimeout(callback) {
      setTimeout(callback, (SERVICE_TIMEOUT + 2) * 1000);
    },

    function testListingServicesShouldTriggerRectifications(callback) {
      // We list services in parallel to make sure there aren't any race
      // conditions.
      // All 3 low timeout services should be deleted, only the high timeout one
      // should still be alive.
      async.forEach(new Array(1).join(' ').split(' '), function(_, callback) {
        client.services.list({}, function(err, data, nextMarker) {
          assert.ifError(err);
          assert.equal(data.length, 1);
          assert.equal(data[0].id, serviceIds[3]);
          callback();
        });
      }, callback);
    },

    function verifyServicesTimedOut(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);

        // 4 - service.join, 3 - service.timeout
        assert.equal(data.length, 4 + 3);

        [0, 1, 2, 3].forEach(function(i) {
          assert.ok(data[i].payload.id.indexOf('service-') === 0);
          assert.equal(data[i].type, 'service.join');
        });

        [4, 5, 6].forEach(function(i) {
          assert.ok(data[i].payload.id.indexOf('service-') === 0);
          assert.equal(data[i].type, 'service.timeout');
        });

        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_services_heartbeating_using_HeartBeater_and_fetch_service_rectification'] = function(test, assert) {
  var SERVICE_TIMEOUT = 3, SERVICE_ID = 'my-service-1';

  async.waterfall([
    function createService(callback) {
      client.services.create(SERVICE_ID, SERVICE_TIMEOUT, {}, function(err, data, hb) {
        assert.ifError(err);
        assert.ok(data.hasOwnProperty('token'));

        callback(null, hb);
      });
    },

    function startHeartbeating(hb, callback) {
      hb.start();
      setTimeout(function() {
        hb.stop();
        callback();
      }, 10 * 1000);
    },

    function verifyServiceIsStillAlive(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 1);
        assert.equal(data[0].type, 'service.join');
        assert.equal(data[0].payload.id, SERVICE_ID);
        callback();
      });
    },

    function waitForServicesToTimeout(callback) {
      setTimeout(callback.bind(null, null), (SERVICE_TIMEOUT + 2) * 1000);
    },

    function testFetchingServiceShouldTriggerRectifications(callback) {
      // We fetch services in parallel to make sure there aren't any race
      // conditions
      async.forEach(new Array(12).join(' ').split(' '), function(_, callback) {
        client.services.get(SERVICE_ID, function(err, data) {
          assert.ok(err);
          assert.equal(err.statusCode, 404);
          callback();
        });
      }, callback);
    },

    function verifyServiceTimedOut(callback) {
      client.events.list(null, {}, function(err, data, nextMarker) {
        assert.ifError(err);
        assert.equal(data.length, 2);
        assert.equal(data[1].type, 'service.timeout');
        assert.equal(data[1].payload.id, SERVICE_ID);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_last_seen_is_removed_when_deleting_a_service'] = function(test, assert) {
  var serviceId = 'my-service-abcd1', startTs = Date.now();

  async.waterfall([
    function createService(callback) {
      client.services.create(serviceId, 30, {}, function(err, data, hb) {
        assert.ifError(err);
        assert.ok(data.hasOwnProperty('token'));

        callback(null, data.token);
      });
    },

    function heartbeatService(initialToken, callback) {
      client.services.heartbeat(serviceId, initialToken, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function testGetServiceVerifyLastSeenHasBeenUpdated(callback) {
      client.services.get(serviceId, function(err, srv) {
        assert.ifError(err);
        assert.ok(srv.last_seen >= startTs);
        callback();
      });
    },

    function removeService(callback) {
      client.services.remove(serviceId, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function recreateServiceWithSameId(callback) {
      client.services.create(serviceId, 30, {}, function(err, data, hb) {
        assert.ifError(err);
        assert.ok(data.hasOwnProperty('token'));

        callback();
      });
    },

    function testGetServiceVerifyInitialLastSeenIsNul(callback) {
      client.services.get(serviceId, function(err, srv) {
        assert.ifError(err);
        assert.equal(srv.last_seen, null);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_create_services_different_account_isolation'] = function(test, assert) {
  // Create services with the same IDs accross multiple accounts and make sure
  // stuff is isolated properly.
  var usernames = ['joe1', 'joe2', 'joe3', 'joe4', 'joe5', 'joe6', 'joe7',
                   'joe8', 'joe9'],
      serviceIds = ['my-service-1', 'my-service-2', 'my-service-3'],
      tags = ['api', 'dfw', 'www', 'mysql'];

  async.series([
    function createServices(callback) {
      async.forEach(usernames, function(username, callback) {
        var client = common.getClient(username);

        async.forEach(serviceIds, function(serviceId, callback) {
          var name, payload;

          name = sprintf('%s-%s', serviceId, username);
          payload = {'tags': tags, 'metadata': {'name': name}};
          client.services.create(serviceId, 30, payload, callback);
        }, callback);
      }, callback);
    },

    function verifyListServicesAccountIsolation(callback) {
      async.forEach(usernames, function(username, callback) {
        var client = common.getClient(username);

        client.services.list(null, function(err, srvs) {
          assert.ifError(err);

          assert.equal(srvs.length, serviceIds.length);

          srvs.forEach(function(srv) {
            var name = sprintf('%s-%s', srv.id, username);

            assert.deepEqual(srv.tags, tags);
            assert.deepEqual(srv.metadata, {'name': name});
          });

          callback();
        });
      }, callback);
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

// callback(error, nextToken)
function fakeHeartbeat(client, serviceId, token, callback) {
  var url = '/services/' + serviceId + '/heartbeat',
      payload = {'token': token},
      reqOptions = {'expectedStatusCode': 200};
  
  client._request(url, 'POST', payload, reqOptions, function(err, res) {
    callback(err, err ? null : res.body.token);
  });
}

exports['test_late_heartbeats_are_ok'] = function(test, assert) {
  // this test must run with the rectifier off. Otherwise, it will sporadically fail.
  if ('yes' === process.env['WITH_RECTIFIER']) {
    console.log('skipping that that requires rectifier be off.');
    test.finish();
    return;
  }
  
  var serviceId = 'svc-with-late-heartbeats',
      nextToken,
      timeout = 5;
  
  async.waterfall([
    function register(callback) {
      var payload = { 'tags': ['tag1', 'tag2'], 'metadata': { 'region': 'dfw', 'port': '2200'}};
      client.services.create(serviceId, timeout, payload, callback);
    },
    
    function grabToken(data, heartbeater, callback) {
      nextToken = heartbeater._nextToken;
      callback(null);
    },
    
    function doFirstHeartbeat(callback) {
      fakeHeartbeat(client.services, serviceId, nextToken, function(err, newToken) {
        assert.ifError(err);
        assert.ok(newToken !== nextToken);
        nextToken = newToken;
        callback(err);
      });
    },
    
    function waitPastTimeout(callback) {
      setTimeout(function() { callback(null); }, (timeout + 3) * 1000);
    },
    
    function doLateHeartbeat(callback) {
      fakeHeartbeat(client.services, serviceId, nextToken, function(err, newToken) {
        assert.ifError(err);
        assert.ok(newToken !== nextToken);
        nextToken = newToken;
        callback(err);
      });
    },
    
    function getService(callback) {
      client.services.get(serviceId, function(err, data) {
        assert.ifError(err);
        assert.strictEqual(data.id, serviceId);
        callback(err);
      });
    }
  ],
    
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
