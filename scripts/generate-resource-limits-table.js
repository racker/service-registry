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

var sprintf = require('sprintf').sprintf;

var limits = require('../lib/db/models/account').Account.fields.limits.default_value;

function capitalize(v) {
  return v.toUpperCase();
}

function main() {
  var key, resource, value, str;

  str = 'Resource | Limit\n';
  str += '-------- | -----\n';

  for (key in limits) {
    if (limits.hasOwnProperty(key)) {
      value = limits[key];
      resource = key.replace('_', ' ').replace(/^.|\s\S/g, capitalize);
      str += sprintf('%s | %s\n', resource, value);
    }
  }

  fs.writeFileSync(path.join(__dirname + '/../fixtures/misc/resource-limits.md'), str);
}

main();
