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

var dgram = require('dgram');

var optimist = require('optimist');
var async = require('async');
var logmagic = require('logmagic');
var log = require('logmagic').local('scripts.verify-api-functionality');
var sprintf = require('sprintf').sprintf;
var uuid = require('node-uuid');
var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;
var logging = require('rackspace-shared-utils/lib/logging');
var misc = require('rackspace-shared-utils/lib/misc');
var Client = require('service-registry-client').Client;

var SERVICE_TIMEOUT = 3;

var argv = require('optimist')
    .usage('Usage: $0 --url=<api url> --username=<api key> --key=<api key>' +
           ' --region=<account region> --prefix=<name prefix> --auth-url=<auth url>')
    .default('region', 'us')
    .default('prefix', 'us-')
    .default('auth-url', 'https://identity.api.rackspacecloud.com/v2.0')
    .describe('l', 'Use this if script is running locally, log output to stdout instead of syslog')
    .demand(['url', 'username', 'key'])
    .argv;

if (!argv.l) {
  logmagic.registerSink('udpSink', logging.getUdpLoggingSink(dgram.createSocket('udp4'), 'localhost', 512));
  logmagic.route('scripts.verify-api-functionality', logmagic.DEBUG, 'udpSink');
}

/*
 * 1. Create a service
 * 2. Heartbeat the service
 * 3. Check that service last_seen is current
 * 4. List events after current time to make sure list is empty
 * 5. Heartbeat service after specified timeout
 * 6. Check events for service.timeout
 * 7. Set a configuration value
 * 8. Check events for configuration_value.update
 * 9. Remove configuration value
 * 10. Check events for configuration_value.remove
 *
 * If any errors are encountered, exit with status 1.
 * Otherwise, exit wtih status 0.
 *
 * To run this script locally use the following command:
 * ./scripts/verify-api-functionality.js --url=http://127.0.0.1:9001/v1.0/ \
 * --auth-url=http://127.0.0.1:23542/v2.0 --username=joe1 --key=dev -l
 */
function main() {
  var client = new Client(argv.username, argv.key, argv.region, {'url': argv.url, 'debug': true, 'authUrl': argv['auth-url']}),
      startTs = Date.now() - 1000;

  async.waterfall([
    function initialListEvents(callback) {
      var ts = Date.now(),
          from = highUUIDFromTimestamp(ts).toString();

      log.info('Initially listing events...');
      client.events.list(from, {}, function(err, data, nextMarker) {
        if (err) {
          callback(err);
          return;
        }

        if (data.length !== 0) {
          callback(new Error('Events list should have no events'));
          return;
        }

        callback();
      });
    },

    function createService(callback) {
      var serviceId = argv.prefix + 'serviceId';

      log.infof('Creating service...');
      client.services.create(serviceId, SERVICE_TIMEOUT, {}, function(err, data, hb) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, serviceId, data.token);
      });
    },

    function initialGetService(serviceId, initialToken, callback) {
      log.infof('Getting service ${serviceId}... ', {'serviceId': serviceId});
      client.services.get(serviceId, function(err, data) {
        if (data.last_seen !== null) {
          callback(new Error('last_seen must be null initially'));
          return;
        }

        callback(err, serviceId, initialToken);
      });
    },

    function listEventsAfterServiceCreate(serviceId, initialToken, callback) {
      var from = highUUIDFromTimestamp(startTs).toString();

      log.info('Listing events...');
      client.events.list(from, {}, function(err, data, nextMarker) {
        if (err) {
          callback(err);
          return;
        }

        if (data.length !== 1) {
          callback(new Error('Events list should have a single entry'));
          return;
        }

        if (data[0].type !== 'service.join') {
          callback(new Error('Event type should be service.join'));
          return;
        }

        callback(null, serviceId, initialToken);
      });
    },

    function heartbeatService(serviceId, initialToken, callback) {
      var ts = Date.now();

      log.infof('Heartbeating service ${serviceId}... ', {'serviceId': serviceId});
      client.services.heartbeat(serviceId, initialToken, function(err, nextToken) {
        callback(err, serviceId, nextToken, ts);
      });
    },

    function getServiceLastSeenUpdated(serviceId, nextToken, ts, callback) {
      log.infof('Checking last_seen for service ${serviceId}... ', {'serviceId': serviceId});
      client.services.get(serviceId, function(err, data) {
        if (err) {
          callback(err);
          return;
        }

        if (data.last_seen < ts) {
          callback(new Error('service last_seen was not updated'));
          return;
        }

        callback(null, serviceId, nextToken, ts);
      });
    },

    function heartbeatSession(serviceId, nextToken, ts, callback) {
      log.infof('Heartbeating service ${serviceId}...', {'serviceId': serviceId});
      client.services.heartbeat(serviceId, nextToken, function(err, nextToken) {
        callback(err, ts, serviceId);
      });
    },

    function wait(ts, serviceId, callback) {
      log.info('Waiting for service to timeout...');
      callback = callback.bind(null, null, ts, serviceId);
      setTimeout(callback, (SERVICE_TIMEOUT + 2) * 1000);
    },

    function listEventsAfterTimeout(ts, serviceId, callback) {
      var from = highUUIDFromTimestamp(ts).toString();

      log.info('Checking events list for service.timeout event...');
      client.events.list(from, {}, function(err, data, nextMarker) {
        var timeoutEvent;

        if (err) {
          callback(err);
          return;
        }

        if (data.length < 1) {
          callback(new Error('Events list should have a services.timeout event: ' + data));
          return;
        }

        timeoutEvent = data.pop();
        if (timeoutEvent.type !== 'service.timeout') {
          callback(new Error('Event payload did not have correct type after ' +
                   'service timed out: ' +
                   timeoutEvent));
          return;
        }

        if (timeoutEvent.payload.id !== serviceId) {
          callback(new Error(sprintf('Service IDs do not match: %s, %s',
                   serviceId,
                   timeoutEvent.payload.id)));
          return;
        }

        callback();
      });
    },

    function initialConfigurationValueUpdate(callback) {
      var from = highUUIDFromTimestamp(Date.now()).toString(),
          configurationId = argv.prefix + 'my-value-1', value;

      log.infof('Setting configuration ${configurationId}...',
                {'configurationId': configurationId});

      value = 'test value ' + misc.randstr(10);
      client.configuration.set(configurationId, value, function(err, data) {
        callback(err, from, configurationId, value);
      });
    },

    function checkEventCreated(from, configurationId, expectedValue, callback) {
      var updatedEvent;

      log.info('Checking events list for configuration_value.update event...');
      client.events.list(from, {}, function(err, data, nextMarker) {
        if (err) {
          callback(err);
          return;
        }

        if (data.length < 1) {
          callback(new Error('Events list should have a configuration_value.update event'));
          return;
        }

        updatedEvent = data.pop();
        if (updatedEvent.type !== 'configuration_value.update') {
          callback(new Error('Event payload did not have correct type after ' +
                   'configuration_value was updated: ' +
                   updatedEvent));
          return;
        }

        if (updatedEvent.payload.configuration_value_id !== configurationId) {
          callback(new Error('Event payload did not have correct id after ' +
                   'configuration value was updated: ' +
                   updatedEvent));
          return;
        }

        if (updatedEvent.payload.new_value !== expectedValue) {
          callback(new Error('Event payload did not have correct value after ' +
                   'configuration_value was updated: ' +
                   updatedEvent));
          return;
        }

        callback(null, configurationId, expectedValue);
      });
    },

    function removeConfigurationValue(configurationId, expectedValue, callback) {
      var from = highUUIDFromTimestamp(Date.now()).toString();

      log.infof('Removing configuration ${configurationId}...',
                {'configurationId': configurationId});
      client.configuration.remove(configurationId, function(err, value) {
        callback(err, from, configurationId, expectedValue);
      });
    },

    function checkRemovedEventCreated(from, configurationId, expectedValue, callback) {
      var removedEvent;

      log.info('Checking events list for configuration_value.remove event...');
      client.events.list(from, {}, function(err, data, nextMarker) {
        if (err) {
          callback(err);
          return;
        }

        if (data.length < 1) {
          callback(new Error('Events list should have configuration_value.remove event: ' + data));
          return;
        }

        removedEvent = data.pop();
        if (removedEvent.type !== 'configuration_value.remove') {
          callback(new Error('Event payload did not have correct type after ' +
                   'configuration_value was removed:  ' +
                   removedEvent));
          return;
        }

        if (removedEvent.payload.configuration_value_id !== configurationId) {
          callback(new Error('Event payload did not have correct id after ' +
                   'configuration value was removed: ' +
                   removedEvent));
          return;
        }

        if (removedEvent.payload.old_value !== expectedValue) {
          callback(new Error('Event payload did not have correct value after ' +
                   'configuration value was removed: ' +
                   removedEvent));
          return;
        }

        callback();
      });
    },

    function setConfigurationValueWithNamespace(callback) {
      var from = highUUIDFromTimestamp(Date.now()).toString(),
          configurationId = sprintf('/%s/namespace/%s', argv.prefix, 'my-value-2'), value;

      log.infof('Setting configuration with a namespace ${configurationId}...',
                {'configurationId': configurationId});

      value = 'test value with namespace' + misc.randstr(10);
      client.configuration.set(configurationId, value, function(err, data) {
        callback(err, from, configurationId, value);
      });
    },

    function checkEventCreated(from, configurationId, expectedValue, callback) {
      var updatedEvent;
      log.info('Checking events list for configuration_value.update event...');

      client.events.list(from, {}, function(err, data, nextMarker) {
        if (err) {
          callback(err);
          return;
        }

        if (data.length < 1) {
          callback(new Error('Events list should have a configuration_value.update event'));
          return;
        }

        updatedEvent = data.pop();

        if (updatedEvent.type !== 'configuration_value.update') {
          callback(new Error('Event payload did not have correct type after ' +
                   'configuration_value was updated: ' +
                   updatedEvent));
          return;
        }

        if (updatedEvent.payload.configuration_value_id !== configurationId) {
          callback(new Error('Event payload did not have correct id after ' +
                   'configuration value was updated: ' +
                   updatedEvent));
          return;
        }

        if (updatedEvent.payload.new_value !== expectedValue) {
          callback(new Error('Event payload did not have correct value after ' +
                   'configuration_value was updated: ' +
                   updatedEvent));
          return;
        }

        callback();
      });
    }
  ],

  function(err) {
    if (err) {
      log.errorf('Error: ${err}', {'err': err});
      setTimeout(process.exit.bind(null, 1), 500);
      return;
    }

    log.info('Verification successful');
    setTimeout(process.exit.bind(null, 0), 500);
    return;
  });
}

main();
