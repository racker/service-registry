/**
 *  Copyright 2012 Rackspace
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

var util = require('util');
var async = require('async');

var Client = require('../lib/client').Client;

var client = new Client('joe', 'dev', null, {'logToConsole': true,
  'url': 'http://127.0.0.1:9000/v1.0/',
  'authUrl': 'http://127.0.0.1:23542/v2.0'});

async.waterfall([
  function createService(callback) {
    var payload = {
      'tags': ['tag1', 'tag2'],
      'metadata': {'region': 'dfw', 'port': '9000'}
    };

    client.services.create('serviceId', 15, payload, function(err, data, hb) {
      console.log('Create service');
      console.log('error: ' + err);
      console.log('data: ' + data);

      // optional:
      // hb.start();
      hb.on('error', function(err) {
        // recover. Probably recreate the session and start up again.
      });

      callback(null, data.token);
    });
  },

  function getService(initialToken, callback) {
    client.services.get('serviceId', function(err, data) {
      console.log('Get service');
      console.log('error: ' + err);
      console.log('data: ' + data);
      callback(null, initialToken);
    });
  },

  function heartbeatService(initialToken, callback) {
    client.services.heartbeat('serviceId', initialToken, function(err, nextToken) {
      console.log('Heartbeat services');
      console.log('error: ' + err);
      console.log('next token: ' + nextToken);
      callback();
    });
  },

  function updateService(callback) {
    var payload = {'heartbeat_timeout': 20};

    client.services.update('serviceId', payload, function(err, id) {
      console.log('Update service');
      console.log('error: ' + err);
      callback();
    });
  },

  function listServices(callback) {
    client.services.list({}, function(err, data) {
      console.log('List services');
      console.log('error: ' + err);
      console.log('data: ' + data);
      callback();
    });
  },

  function removeService(callback) {
    client.services.remove('serviceId', function(err) {
      console.log('Remove service');
      console.log('error: ' + err);
      callback();
    });
  },

  function setConfiguration(callback) {
    client.configuration.set('configId', 'configValue', function(err) {
      console.log('Set configuration');
      console.log('error: ' + err);
      callback();
    });
  },

  function getConfiguration(callback) {
    client.configuration.get('configId', function(err, data) {
      console.log('Get configuration');
      console.log('error: ' + err);
      console.log('data: ' + data);
      callback();
    });
  },

  function listConfiguration(callback) {
    client.configuration.list(null, function(err, data) {
      console.log('List configuration');
      console.log('error: ' + err);
      console.log('data: ' + data);
      callback();
    });
  },

  function removeConfiguration(callback) {
    client.configuration.remove('configId', function(err) {
      console.log('Remove configuration');
      console.log('error: ' + err);
      callback();
    });
  },

  function listEvents(callback) {
    client.events.list(null, {}, function(err, data) {
      console.log('List events');
      console.log('error: ' + err);
      console.log('data: ' + util.inspect(data));
      callback();
    });
  }

], process.exit);
