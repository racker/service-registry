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

var optimist = require('optimist');
var async = require('async');
var sprintf = require('sprintf').sprintf;
var logmagic = require('logmagic');
var Client = require('service-registry-client').Client;
var randstr = require('rackspace-shared-utils/lib/misc').randstr;
var logging = require('rackspace-shared-utils/lib/logging');

var argv = require('optimist')
    .usage('Usage: $0 --username=<api username> --api-key=<api key>' +
           ' --services=<number of services to create>' +
           ' --heartbeat-interval=<service heartbeat interval>' +
           ' --tags=<number of tags per service>' +
           ' --metadata=<number of metadata items per service>' +
           ' [--url=<api endpoint url>]' +
           ' [--stats]' +
           ' [--ensure]' +
           ' [--debug]')
    .boolean(['debug', 'ensure'])
    .default('services', 50)
    .default('heartbeat-interval', 15)
    .default('tags', 5)
    .default('metadata', 10)
    .default('debug', false)
    .default('ensure', false)
    .default('url', 'https://dfw.registry.api.rackspacecloud.com/v1.0')
    .demand(['username', 'api-key'])
    .describe('ensure', 'Ensure that a service count is constant. This means ' +
                        'if a service dies it will be re-created.')
    .describe('stats', 'Print erorr statistics on exit')
    .argv;

function createService(stats, client, index, ensure, callback) {
  console.log('Creating service: ' + index);

  async.waterfall([
    function registerService(callback) {
      var payload, tags = [], metadata = {}, i;

      for (i = 0; i < argv.tags; i++) {
        tags.push(randstr(10));
      }

      for (i = 0; i < argv.metadata; i++) {
        metadata[randstr(5)] = randstr(15);
      }

      payload = {'tags': tags, 'metadata': metadata};
      client.services.register('srv-test-' + randstr(5), argv['heartbeat-interval'], payload, {}, function(err, _, hb) {
        if (err) {
          stats.errors.total++;
          stats.errors.register++;
        }

        callback(err, hb);
      });
    },

    function startHeartbeating(hb, callback) {
      hb.start();
      hb.on('error', function(err) {
        console.log('Service died: ' + err.toString());
        console.log(err);

        stats.errors.total++;
        stats.errors.heartbeat++;

        if (ensure) {
          console.log('Ensuring constant number of active services');
          createService(stats, client, index, ensure, function() {});
        }
      });

      callback();
    }
  ],

  function(err) {
    if (err) {
      console.log('Failed to create a service: ' + err.toString());
    }
    else {
      console.log('Service created: ' + index);
    }

    callback();
  });
}

function main() {
  var items = [], i, client,
      stats = {'errors': {'total': 0, 'register': 0, 'heartbeat': 0}};

  client = new Client(argv.username, argv['api-key'], 'us', {'url': argv.url,
                                                             'debug': argv.debug});

  if (argv.debug) {
    logmagic.route('service-registry-client.*', logmagic.DEBUG, 'console');
  }

  for (i = 0; i < argv.services; i++) {
    items.push(i);
  }

  async.forEach(items, function(index, callback) {
    createService(stats, client, index, argv.ensure, function(err) {
      // Error is not fatal
      callback();
    });
  },

  function() {
    console.log('Created ' + argv.services + ' services');
  });

  process.on('SIGINT', function() {
    var key;
    console.log('Exiting...\n');

    if (argv.stats) {
      for (key in stats.errors) {
        if (stats.errors.hasOwnProperty(key)) {
          console.log(sprintf('# %s errors: %s', key, stats.errors[key]));
        }
      }
    }

    process.exit();
  });
}

main();
