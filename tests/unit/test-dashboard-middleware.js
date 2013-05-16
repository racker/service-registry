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

var ipAuth = require('../../lib/dashboard/middleware/ipvalidation');

function makeMockRequest(forwardedFor, remoteAddress) {
  var req = {
    headers: [],
    connection: {
      remoteAddress: null
    }
  };
  if (forwardedFor) {
    req.headers['x-forwarded-for'] = forwardedFor;
  }
  if (remoteAddress) {
    req.connection.remoteAddress = remoteAddress;
  }
  return req;
}

exports['test_get_ip_for_forward'] = function(test, assert) {
  assert.strictEqual(ipAuth.getIp(makeMockRequest('127.0.0.1', null)), '127.0.0.1');
  assert.strictEqual(ipAuth.getIp(makeMockRequest('127.0.0.1', '127.0.0.2')), '127.0.0.1');
  assert.strictEqual(ipAuth.getIp(makeMockRequest('127.0.0.1,127.0.0.2', '127.0.0.3')), '127.0.0.1');
  test.finish();
};

exports['test_get_ip_from_addr'] = function(test, assert) {
  assert.strictEqual(ipAuth.getIp(makeMockRequest(null, '127.0.0.1')), '127.0.0.1');
  test.finish();
};

exports['test_ip_acceptance'] = function(test, assert) {
  assert.ok(ipAuth.isAccepted('127.0.0.1'));
  assert.ok(ipAuth.isAccepted('127.0.0.2'));
  assert.ok(ipAuth.isAccepted('192.168.0.1'));
  assert.ok(ipAuth.isAccepted('192.168.0.2'));
  assert.ok(ipAuth.isAccepted('172.16.0.1'));
  assert.ok(ipAuth.isAccepted('172.16.0.2'));
  assert.ok(ipAuth.isAccepted('10.0.0.1'));
  assert.ok(ipAuth.isAccepted('10.0.0.2'));
  
  assert.ok(!ipAuth.isAccepted('5.5.5.5'));
  assert.ok(!ipAuth.isAccepted('6.6.6.6'));
  
  // any ipv6 address will fail.
  test.finish();
};
