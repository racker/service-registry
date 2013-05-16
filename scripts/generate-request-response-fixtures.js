#!/usr/bin/env node
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

var fs = require('fs');
var path = require('path');
var url = require('url');

var optimist = require('optimist');
var async = require('async');
var Client = require('service-registry-client').Client;
var log = require('logmagic').local('scripts.generate-fixtures');
var sprintf = require('sprintf').sprintf;
var request = require('rackspace-shared-utils/lib/request');
var origRequest = require('rackspace-shared-utils/lib/request').request;

var client = new Client('joe', 'dev', null, {'debug': true,
  'url': 'http://127.0.0.1:9000/v1.0/',
  'authUrl': 'http://127.0.0.1:23542/v2.0',
  'raw': true});

var PUBLIC_ENDPOINT_URL = 'https://dfw.registry.api.rackspacecloud.com/';
var SERVICE_ID1 = 'dfw1-api';
var HEARTBEAT_TIMEOUT = 3;

var TOKENS = [
  '6bc8d050-f86a-11e1-a89e-ca2ffe480b20',
  '36865510-f7da-11e1-b732-793f90dd0c35'
];

var TIMESTAMPS = [
  1346967146190,
  1346967146370
];

var WRITE_MOCK_REQUESTS = true;

var argv = require('optimist')
    .usage('Usage: $0 --out=<output folder>')
    .default('out', 'fixtures')
    .argv;

var fixtureDirs = [argv.out, path.join(argv.out,'/request'), path.join(argv.out, '/response')];

function writeFixtureFile(fixturePath, data, callback) {
  fs.writeFile(fixturePath, data, callback);
}

function checkDir(dir, callback) {
  log.infof('checkDir');

  fs.mkdir(dir, function(err) {
    if (err && err.code === 'EEXIST') {
      err = null;
    }
    callback(err);
  });
}

function replaceDynamicValues(data) {
  var value, counter = 0, counter1 = 0;

  data.values.forEach(function(value) {
    // Events
    if (value.hasOwnProperty('payload')) {
      if (value.hasOwnProperty('id')) {
        value.id = TOKENS[counter++];
      }

      if (value.hasOwnProperty('timestamp')) {
        value.timestamp = TIMESTAMPS[counter++];
      }
    }
  });

  return data;
}

request.request = function(reqUrl, method, body, options, callback) {
  // We mock the request function so we can save the request fixtures
  var reqPath = url.parse(reqUrl).pathname.replace('/v1.0/7777/', '').replace('/', '-'),
      filePath = sprintf('./fixtures/request/%s-%s.json', reqPath, method.toLowerCase()),
      reqBody = body;

  if (WRITE_MOCK_REQUESTS && reqUrl.indexOf('/v1.0/7777') !== -1 && body) {
    reqBody = JSON.parse(reqBody);

    // Do any body processing here before stringifying it back

    reqBody = JSON.stringify(reqBody, null, 4);
    fs.writeFileSync(filePath, reqBody, 'utf8');
  }

  origRequest.apply(this, arguments);
};

function main() {
  var requestDir = path.join(argv.out, 'request'),
      responseDir = path.join(argv.out, 'response');

  async.waterfall([
    function createFixtureDirs(callback) {
      async.forEachSeries(fixtureDirs, checkDir, callback);
    },

    function getLimits(callback) {
      log.infof('getLimits');
      client.account.getLimits(function(err, data) {
        callback(err, data);
      });
    },

    function writeLimitsFixture(data, callback) {
      log.infof('writeLimitsFixture');
      var fixturePath = sprintf('./%s/limits-get.json', responseDir);

      writeFixtureFile(fixturePath, data.body, callback);
    },

    function getServiceNotFound(callback) {
      log.infof('getServiceNotFound');
      client.services.get('srvNotFound', function(err, data) {
        callback(null, err.response);
      });
    },

    function writeServiceNotFoundFixture(data, callback) {
      log.infof('writeServiceNotFoundFixture');
      var fixturePath = sprintf('./%s/services-not-found-get.json', responseDir),
          fixtureData = JSON.parse(data.body);

      fixtureData.txnId = '.rh-qyek.h-farscape.r-q3i5psGp.c-3.ts-1347320188220.v-0.1';
      writeFixtureFile(fixturePath, JSON.stringify(fixtureData, null, 4), callback);
    },

    function createServiceNoTags(callback) {
      log.infof('createServiceNoTags');
      client.services.create('dfw1-api', HEARTBEAT_TIMEOUT, {}, function(err, data) {
        callback(err);
      });
    },

    function createService(callback) {
      log.infof('createService');
      var payload = {
        'tags': ['database', 'mysql'],
        'metadata': {'region': 'dfw', 'port': '3306', 'ip': '127.0.0.1',
                     'version': '5.5.24-0ubuntu0.12.04.1 (Ubuntu)'}
      };

      client.services.create('dfw1-db1', HEARTBEAT_TIMEOUT, payload, function(err, data) {
        callback(err, JSON.parse(data.body));
      });
    },

    function writeHeartbeatRequestFixture(data, callback) {
      log.infof('writeHeartbeatRequestFixture');
      var fixturePath = sprintf('./%s/service-%s-heartbeat-post.json',
                                requestDir, SERVICE_ID1);

      writeFixtureFile(fixturePath, JSON.stringify(data, null, 4), function() {
        callback(null, data);
      });
    },

    // Heartbeat response is the same as create service response
    function writeHeartbeatResponseFixture(data, callback) {
      data.token = TOKENS[1];

      log.infof('writeHeartbeatRequestFixture');
      var fixturePath = sprintf('./%s/services-%s-heartbeat-post.json',
                                responseDir, SERVICE_ID1);

      writeFixtureFile(fixturePath, JSON.stringify(data, null, 4), callback);
    },

    function getService(callback) {
      log.infof('getService');
      client.services.get('dfw1-db1', function(err, data) {
        callback(err, data);
      });
    },

    function writeServiceFixture(data, callback) {
      log.infof('writeServiceFixture');
      var fixturePath = sprintf('./%s/services-dfw1-db1-get.json', responseDir),
          fixtureData = JSON.parse(data.body);

      writeFixtureFile(fixturePath, JSON.stringify(fixtureData, null, 4), callback);
    },

    function listServices(callback) {
      log.infof('listServices');
      client.services.list(null, function(err, data, nextMarker) {
        callback(err, data);
      });
    },

    function writeListServicesFixture(data, callback) {
      log.infof('writeListServicesFixture');
      var fixturePath = sprintf('%s/services-get.json', responseDir),
          fixtureData = JSON.parse(data.body);

      fixtureData = replaceDynamicValues(fixtureData);
      fixtureData = JSON.stringify(fixtureData, null, 4);
      writeFixtureFile(fixturePath, fixtureData, callback);
    },

    function listServicesForTag(callback) {
      log.infof('listServicesForTag');
      client.services.listForTag('database', {}, function(err, data) {
        callback(err, data);
      });
    },

    function writeListServicesForTagFixture(data, callback) {
      log.infof('writeListServicesForTagFixture');
      var fixturePath = sprintf('%s/services-tag-database-get.json', responseDir),
          fixtureData = JSON.parse(data.body);

      fixtureData = replaceDynamicValues(fixtureData);
      fixtureData = JSON.stringify(fixtureData, null, 4);
      writeFixtureFile(fixturePath, fixtureData, callback);
    },

    function listServicesWithLimit(callback) {
      log.infof('listServicesWithLimit');
      client.services.list({'limit': 1}, function(err, data, nextMarker) {
        callback(err, data);
      });
    },

    function writeFixture(data, callback) {
      var fixturePath = sprintf('%s/services-get-limit-1-page-1.json', responseDir),
          fixtureData = JSON.parse(data.body);

      fixtureData.metadata.next_href = fixtureData.metadata.next_href.replace(/https:\/\/(.*?)\//, PUBLIC_ENDPOINT_URL);
      writeFixtureFile(fixturePath, JSON.stringify(fixtureData, null, 4), callback);
    },

    function listServicesWithMarker(callback) {
      log.infof('listServicesWithLimit');
      client.services.list({'marker': 'dfw1-db1'}, function(err, data, nextMarker) {
        callback(err, data);
      });
    },

    function writeFixture(data, callback) {
      var fixturePath = sprintf('%s/services-get-with-marker-page-2.json', responseDir),
          fixtureData = JSON.parse(data.body);

      writeFixtureFile(fixturePath, JSON.stringify(fixtureData, null, 4), callback);
    },

    function removeService(callback) {
      log.infof('removeService');
      client.services.remove('dfw1-db1', function(err) {
        callback(err);
      });
    },

    function setConfigurationValues(callback) {
      var keys = ['configId', 'configId1', 'configId2'];

      async.forEach(keys, function(key, callback) {
        client.configuration.set(key, 'test value 123456', callback);
      }, callback);
    },

    function getConfigurationValue(callback) {
      client.configuration.get('configId', function(err, data) {
        callback(err, data);
      });
    },

    function writeGetConfigurationFixture(data, callback) {
      log.infof('writeGetConfigurationFixture');
      var fixturePath = sprintf('./%s/configuration-configId-get.json', responseDir);

      writeFixtureFile(fixturePath, data.body, callback);
    },

    function removeConfigurationValue(callback) {
      var key = 'configId';

      client.configuration.remove(key, callback);
    },

    function setConfigurationValuesWithANamespace(callback) {
      WRITE_MOCK_REQUESTS = false;

      var keys = [
        '/production/cassandra/listen_ip',
        '/production/cassandra/listen_port',
        '/production/cassandra/rpc_server/type',
        '/production/cassandra/rpc_server/timeout',
        '/production/zookeeper/listen_ip',
        '/production/zookeeper/listen_port',
      ];

      log.infof('setConfigurationValuesWithANamespace');

      async.forEach(keys, function(key, callback) {
        var value = 'value for ' + key;
        client.configuration.set(key, value, callback);
      }, callback);
    },

    function listConfiguration(callback) {
      WRITE_MOCK_REQUESTS = true;

      log.infof('writeGetConfigurationFixture');
      client.configuration.list({}, function(err, data, nextMarker) {
        callback(err, data);
      });
    },

    function writeListConfigurationFixture(data, callback) {
      var fixturePath = sprintf('./%s/configuration-get.json', responseDir);

      writeFixtureFile(fixturePath, data.body, callback);
    },

    function listConfigurationValuesForANamespace(callback) {
      var fixturePath = sprintf('./%s/configuration-get-for-namespace.json', responseDir);

      log.infof('listConfigurationValuesForANamespace');
      client.configuration.listForNamespace('/production/cassandra', null, function(err, data) {
        writeFixtureFile(fixturePath, data.body, callback);
        callback();
      });
    },

    // Wait before listening events so the services expires and we get timeout
    // event
    function wait(callback) {
      setTimeout(callback, 3200);
    },

    function listEvents(callback) {
      log.infof('listEvents');
      client.events.list(null, {}, function(err, data, nextMarker) {
        callback(err, data);
      });
    },

    function writeEventsFixture(data, callback) {
      log.infof('writeEventsFixture');
      var fixturePath = sprintf('./%s/events-get.json', responseDir),
          fixtureData = JSON.parse(data.body),
          events;

      fixtureData = replaceDynamicValues(fixtureData);
      events = fixtureData.values;
      fixtureData = JSON.stringify(fixtureData, null, 4);
      writeFixtureFile(fixturePath, fixtureData, function(err) {
        callback(err, events);
      });
    },

    function writeEventTypesPartials(events, callback) {
      var typeToFileMap, eventType, fileName, eventItem, fixturePath, data;

      typeToFileMap = {
        'service.join': 'events-partial-service.join.json',
        'service.timeout': 'events-partial-service.timeout.json',
        'service.remove': 'events-partial-service.remove.json',
        'configuration_value.update': 'events-partial-configuration_value.update.json',
        'configuration_value.remove': 'events-partial-configuration_value.remove.json',
      };

      function getMatchingEventItem(type) {
        var eventItem = events.filter(function(item) {
          return (item.type === type);
        })[0];

        return eventItem;
      }

      for (eventType in typeToFileMap) {
        if (typeToFileMap.hasOwnProperty(eventType)) {
          fileName = typeToFileMap[eventType];
          eventItem = getMatchingEventItem(eventType);

          fixturePath = sprintf('./%s/%s', responseDir, fileName);
          data = JSON.stringify(eventItem, null, 4);
          fs.writeFileSync(fixturePath, data, 'utf-8');
        }
      }

      callback();
    }
  ],

  function(err) {
    if (err) {
      log.errorf('Error: ${err}', {'err': err});
      return;
    }

    log.info('Fixture generation successful');
    return;
  });
}

main();
