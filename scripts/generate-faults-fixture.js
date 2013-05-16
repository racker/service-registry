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

var faults = require('../lib/api/fault');

function writeCase(rootdir, niv, obj) {
  var list = 'Error Response Code(s): ', strs = [], key;
  for( key in niv) {
    if(niv.hasOwnProperty(key)) {
      strs.push(key + '(' + niv[key] + ')');
    }
  }
  for( key in obj) {
    if(obj.hasOwnProperty(key)) {
      strs.push(key + '(' + obj[key] + ')');
    }
  }
  list = list + strs.join(', ');
  console.log(list);
}

function processCases(rootdir, obj) {
  var tag, subtag;
  for (tag in obj.faults) {
    if (obj.faults.hasOwnProperty(tag)) {
      for (subtag in obj.faults[tag]) {
        if (obj.faults[tag].hasOwnProperty(subtag)) {
          writeCase(rootdir + tag + '-' + subtag,
            obj.universalFaults,
            obj.faults[tag][subtag]);
        }
      }
    }
  }
}

function buildFaultTable(fn, obj) {
  var str = 'Fault Element | Associated Error Codes | Description\n', elem;
  str += '---------- | ---------------- | ---------\n';

  for (elem in obj.universalFaults) {
    if (obj.universalFaults.hasOwnProperty(elem)) {
      str += sprintf('%s | %s | %s\n', elem, obj.universalFaults[elem], obj.faultDescription[elem]);
    }
  }

  fs.writeFileSync(fn, str, 'utf8');
}

var filePath = path.join(__dirname + '/../fixtures/swiz/faults.md');
buildFaultTable(filePath, faults.faultTable);
