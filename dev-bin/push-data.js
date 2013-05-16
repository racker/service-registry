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

var async = require('async');

var randstr = require('rackspace-shared-utils/lib/misc').randstr;

var common = require('../tests/common');
var joe1 = common.getClient('joe1');
var joe2 = common.getClient('joe2');

// callback(err, serviceId)
function createService(client, callback) {
  var payload = {
    'tags': ['messenger', 'fb303', 'stats', randstr(4)],
    'metadata': {'region': 'dfw', 'port': '5757', 'ip': '127.0.0.1'}
    },
    svcId = 'my-service' + '-' + randstr(8);

  client.services.register(svcId, 20, payload, {}, function(err, _, hb) {
    if (err) {
      callback(err);
      return;
    }

    hb.start();
    callback(null, svcId);
  })
}

function doStuffForClient(client, callback) {
  async.waterfall([
    function createServices(callback) {
      var serviceCreatorCreators = [];

      while (serviceCreatorCreators.length < 20) {
        serviceCreatorCreators.push(createService.bind(null, client));
      }

      async.parallel(serviceCreatorCreators, function(err, serviceIds) {
        callback(err);
      });
    },

    function createConfigurationValues(callback) {
      var arr = new Array(100).join(' ').split(' ');

      async.forEach(arr, function(_, callback) {
        client.configuration.set(randstr(8), randstr(8), callback);
      }, callback);
    }
  ], callback);
}

function main() {
  async.parallel([
    doStuffForClient.bind(null, joe1),
    doStuffForClient.bind(null, joe2)
  ],

  function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log('\n\n\nALL GOOD. NOW WATCH THE HEARTBEATS.\n\n\n');
    }
  });
}

main();
