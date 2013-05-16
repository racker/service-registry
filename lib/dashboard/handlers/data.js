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

var account = require('../../../lib/db/ops/account');
var service = require('../../../lib/db/ops/service');
var configuration = require('../../../lib/db/ops/configuration');

// this is a json api.

function makeContext(req) {
  return {
    account: {
      getKey: function() { return req.params['acctId']; }
    },
    pagination: {
      limit: req.params['limit'],
      marker: req.params['marker'] === 'START' ? '' : req.params['marker']
    }
  };
}

exports.getServicesPage = function(req, res) {
  var result = {
    err: null,
    services: [],
    nextKey: null
  };

  service.getAll(makeContext(req), {usePaginationParams: true}, function(err, svcArr, nextObj) {
    if (err) {
      result.err = err;
    } else {
      result.services = svcArr;
      result.nextKey = nextObj.nextKey;
    }
    res.send(JSON.stringify(result, null, 4));
  });
};

exports.getConfigurationsPage = function(req, res) {
  var result = {
    err: null,
    configurations: [],
    nextKey: null
  };
  configuration.getAll(makeContext(req), {usePaginationParams: true}, function(err, configArr, nextObj) {
    if (err) {
      result.err = err;
    } else {
      result.configurations = configArr;
      result.nextKey = nextObj.nextKey;
    }
    res.send(JSON.stringify(result, null, 4));
  });
};
