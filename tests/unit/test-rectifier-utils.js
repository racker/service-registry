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

var misc = require('rackspace-shared-utils/lib/misc');

var util = require('../../lib/rectifier/util');
var settings = require('../../lib/util/settings');

exports['test_shard_parse_single'] = function(test, assert) {
  var actual = util.parseShards('5'),
      expected = [5];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_multiple_single'] = function(test, assert) {
  var actual = util.parseShards('5,7,9,32'),
      expected = [5,7,9,32];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_single_range'] = function(test, assert) {
  var actual = util.parseShards('1-5'),
      expected = [1, 2, 3, 4, 5];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_multiple_range'] = function(test, assert) {
  var actual = util.parseShards('1-5,10-15'),
      expected = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_mixed'] = function(test, assert) {
  var actual = util.parseShards('1,3,5-9,12,15-18,20-21'),
      expected = [1, 3, 5, 6, 7, 8, 9, 12, 15, 16, 17, 18, 20, 21];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_with_spaces'] = function(test, assert) {
  var actual = util.parseShards('1, 3, 4,5,6 -12, 19'),
      expected = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 19];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_ordering'] = function(test, assert) {
  var actual = util.parseShards('12-15,8,4,7,1-3'),
      expected = [1, 2, 3, 4, 7, 8, 12, 13, 14, 15];
  assert.eql(expected, actual);
  test.finish();
};

exports['test_shard_parse_all'] = function(test, assert) {
  settings.MAX_SHARDS = 10;
  var actual = util.parseShards('ALL'),
      expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.eql(expected, actual);
  settings.reload();
  test.finish();
};

 exports['test_shard_computations'] = function(test, assert) {
   var i = 0, count = 10000, shard, oldShards = settings.RECTIFICATION_SHARDS;
   for (i = 0; i < count; i++) {
     shard = util.computeShard('ac' + misc.randstr(8));
     assert.ok(shard >= 0, 'was ' + shard + ' at ' + i);
     assert.ok(shard < settings.MAX_SHARDS);
   }
   
   //reset rectification shards and do it again.
   settings.RECTIFICATION_SHARDS = 25;
   for (i = 0; i < count; i++) {
      shard = util.computeShard('ac' + misc.randstr(8));
      assert.ok(shard >= 0, 'was ' + shard + ' at ' + i);
      assert.ok(shard < settings.MAX_SHARDS);
    }
   settings.RECTIFICATION_SHARDS = oldShards;
   test.finish();
 };
