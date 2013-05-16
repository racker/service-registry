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

var path = require('path');

var async = require('async');
var EventsFeedPoller = require('service-registry-client').EventsFeedPoller;
var cassInitialize = require('cassandra-orm/lib/init').initialize;
var getConnPool = require('cassandra-orm/lib/orm/utils').getConnPool;
var shutdown = require('cassandra-orm/lib/orm/utils').shutdown;
var Client = require('service-registry-client').Client;

var misc = require('../lib/util/misc');
var settings = require('../lib/util/settings');

var COLUMN_FAMILIES = ['accounts', 'services',
                       'configuration_values', 'events', 'heartbeat_markers',
                       'last_service_heartbeats', 'accounting',
                       'account_activity'];

var EVENT_KEYS = [
  'service.join',
  'service.timeout',
  'service.remove',
  'configuration_value.update',
  'configuration_value.remove',
];


exports.initializeCassandra = function(callback) {
  var options = {};

  options.hosts = settings.CASSANDRA_CLUSTER;
  options.keyspace = settings.CASSANDRA_KEYSPACE;
  options.modelsPath = path.join(__dirname, '../db/models');
  options.migrationsPath = path.join(__dirname, '../../migrations');
  options.readConsistency = settings.CASSANDRA_READ_CONSISTENCY;
  options.writeConsistency = settings.CASSANDRA_WRITE_CONSISTENCY;
  options.logFunc = misc.logCassEvent;
  options.logRewriterFunc = settings.logmagicRewriter;

  cassInitialize(options, callback);
}

exports.truncateColumnFamilies = function(callback) {
  async.forEach(COLUMN_FAMILIES, function(name, callback) {
    getConnPool().execute({}, 'TRUNCATE ' + name, [], callback);
  }, callback);
}

exports.setUp = function(test, assert) {
  async.waterfall([
    exports.initializeCassandra,
    exports.truncateColumnFamilies
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports.tearDown = function(test, assert) {
  // TODO: Only shut it down if this is the last test in the file.
  shutdown(function(err) {
    test.finish();
  });
};

exports.getClient = function getClient(username) {
  var client, options;

  options = {'debug': true, 'url': 'http://127.0.0.1:9000/v1.0/',
             'authUrl': 'http://127.0.0.1:23542/v2.0'};
  client = new Client(username, 'dev', null, options);

  return client;
};

/**
 * Performs the following actions:
 *
 * - instance the EventsFeedPoller
 * - start EventsFeedPoller and record emitted events
 * - wait waitTime ms
 * - stop EventsFeedPoller
 * - call callback with emitted events
 */
exports.waitForEmittedEvents = function(eventsClient, interval, waitTime, callback) {
  var emittedEvents = {},
      eventsPoller = new EventsFeedPoller(eventsClient, {'pollInterval': interval});

  function recordEmittedEvent(type) {
    if (!emittedEvents.hasOwnProperty(type)) {
      emittedEvents[type] = [];
    }

    return function(payload) {
      emittedEvents[type].push(payload);
    }
  }

  async.series([
    function addListeners(callback) {
      EVENT_KEYS.forEach(function(key) {
        eventsPoller.on(key, recordEmittedEvent(key));
      });

      callback();
    },

    function start(callback) {
      eventsPoller.start();
      callback();
    },

    function waitForEventsToAccumulate(callback) {
      setTimeout(callback, waitTime);
    },

    function stopEventsFeedPoller(callback) {
      eventsPoller.stop();
      callback();
    }
  ],

  function(err) {
    callback(err, emittedEvents);
  });
};

exports.valueOrNull = function (obj, path) {
  var it = obj;
  path.split('.').forEach(function(pathPart) {
    if (it !== null && it.hasOwnProperty(pathPart)) {
      it = it[pathPart];
    } else {
      it = null;
    }
  });
  return it;
}
