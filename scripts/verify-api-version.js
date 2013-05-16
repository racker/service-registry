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
var logmagic = require('logmagic');
var log = require('logmagic').local('scripts.verify-api-version');
var sprintf = require('sprintf').sprintf;
var request = require('rackspace-shared-utils/lib/request').request;
var logging = require('rackspace-shared-utils/lib/logging');

var settings = require('../lib/util/settings');

var argv = require('optimist')
    .usage('Usage: $0 --version=<expected version>')
    .demand(['version'])
    .argv;

logmagic.registerSink('udpSink', logging.getUdpLoggingSink(dgram.createSocket('udp4'), 'localhost', 512));
logmagic.route('scripts.verify-api-version', logmagic.DEBUG, 'udpSink');

function main() {
  var url = sprintf('http://127.0.0.1:%s/static/version', settings.PUBLIC_API_PORT);

  request(url, 'GET', null, {'expected_status_codes': [200]}, function(err, res) {
    var actualVersion;

    if (err) {
      log.errorf('Request failed: ${err}', {'err': err});
      setTimeout(process.exit.bind(null, 1), 500);
      return;
    }

    actualVersion = res.body.replace(/^\s+|\s+$/g, '');

    if (argv.version !== actualVersion) {
      log.errorf('Expected ${expected}, got ${actual} version', {'expected': argv.version,
                                                                 'actual': actualVersion});

      setTimeout(process.exit.bind(null, 1), 500);
      return;
    }

    log.infof('Got expected version - ${expected}', {'expected': argv.version});
    setTimeout(process.exit.bind(null, 0), 500);
    return;
  });
}

main();
