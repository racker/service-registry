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

var htpasswd = require('../../lib/util/htpasswd');

var passHash = htpasswd.loadSync('./tests/conf/example-htpasswd');

exports['test_htpasswd_loaded'] = function(test, assert) {
  ['johndoe1', 'johndoe2', 'johndoe3', 'johndoe4'].forEach(function(user) {
    assert.ok(passHash.getHash(user).length > 0);
  });
  assert.ok(!passHash.getHash('not_a_user'));
  test.finish();
};

exports['test_md5'] = function(test, assert) {
  assert.ok(passHash.doesValidate('johndoe1', 'p455wordz'));
  assert.ok(!passHash.doesValidate('johndoe1', 'Xp455wordz'));
  test.finish();
};

exports['test_crypt'] = function(test, assert) {
  // not currently supported.
  assert.ok(!passHash.doesValidate('johndoe2', 'p455wordz'));
  test.finish();
};

exports['test_plain'] = function(test, assert) {
  // also, not currently supported. we don't want to.
  assert.ok(!passHash.doesValidate('johndoe3', 'p455wordz'));
  test.finish();
};

exports['test_sha1'] = function(test, assert) {
  assert.ok(passHash.doesValidate('johndoe4', 'p455wordz'));
  assert.ok(!passHash.doesValidate('johndoe4', 'Xp455wordz'));
  test.finish();
};
