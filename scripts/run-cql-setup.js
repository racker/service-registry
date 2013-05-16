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

var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;

var sprintf = require('sprintf').sprintf;
var async = require('async');

var settings = require('./../lib/util/settings');

/**
 * Paths to CQL set up files.
 * @type {Array.<String>}
 */
var CQL_SETUP_FILES = [
  path.join(__dirname, 'schema/rproxy-combined.cql'),
  path.join(__dirname, 'schema/farscape-combined.cql')
];


/**
 * Keywords which shouldn't be located in the set up file.
 * @type {Array}
 * @const
 */
var BANNED_KEYWORDS = ['drop', 'truncate', 'delete'];


function main() {
  var split, host, port;

  split = settings.CASSANDRA_CLUSTER[0].split(':');
  host = split[0];
  port = split[1];

  async.forEachSeries(CQL_SETUP_FILES, function(file, callback) {
    var content = fs.readFileSync(file).toString().toLowerCase(), cmd;

    BANNED_KEYWORDS.forEach(function(keyword) {
      keyword = keyword.toLowerCase();

      if (content.indexOf(keyword) !== -1) {
        console.log('Setup file contains banned keyword (%s), refusing to run it.', keyword);
        process.exit(2);
      }
    });

    console.log(sprintf('Loading: %s', file));
    cmd = sprintf('/usr/local/bin/cqlsh %s %s < %s', host, port, file);
    exec(cmd, null, function(err, stdout, stderr) {
      if (err) {
        console.log(err);
        process.exit(1);
        return;
      }


      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      callback();
    });
  },

  function(err) {
    console.log('All CQL files loaded');
    process.exit(0);
  });
}

main();
