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
var log = require('logmagic').local('api.handlers.configuration');

var configurationOps = require('../../db/ops/configuration');
var ConfigurationValue = require('../../db/models/configuration_value').ConfigurationValue;
var common = require('./common');
var misc = require('../../util/misc');
var apiUtils = require('../../api/utils');

function fetch(ctx, configurationId, callback) {
  async.series([
    misc.validateQueryStringParam.bind(null, 'configuration_value', 'configurationId', {'id': configurationId}),
    configurationOps.getOne.bind(null, ctx, configurationId, {}, callback)
  ], callback);
}

exports.listOrFetch = function(req, res) {
  var callback, configurationId, result;

  log.debug('listOrFetch', {request: req});
  req.time('configuration.listOrFetch.http');

  configurationId = req.params[0] || '';
  result = apiUtils.getNamespaceAndKeyFromPath('/' + configurationId);

  if (result.key) {
    // Key is provided, single value is being retrieved
    callback = common.swizResponseCallback(req, res, {'stripKeyPrefix': true});
    fetch(req.ctx, configurationId, callback);
  }
  else if (result.namespace) {
    callback = common.swizListResponseCallback(req, res, {'stripKeyPrefix': true});
    configurationOps.getForNamespace(req.ctx, result.namespace, {}, callback);
  }
  else {
    callback = common.swizListResponseCallback(req, res, {'stripKeyPrefix': true});
    configurationOps.getAll(req.ctx, {}, callback);
  }
};

exports.update = function(req, res) {
  var callback = common.updateResponseCallback(req, res),
      configurationId = req.params[0];

  log.debug('update', {request: req});
  req.time('configuration.update.http');

  misc.validateQueryStringParam('configuration_value_qs', 'configurationId', {'id': configurationId}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    req.checkAndOnSuccess('configuration_value', null, function(cleaned) {
      configurationOps.update(req.ctx, configurationId, cleaned, callback);
    });
  });
};

exports.remove = function(req, res) {
  var callback = common.deleteResponseCallback(req, res),
      configurationId = req.params[0];

  log.debug('remove', {request: req});
  req.time('configuration.remove.http');

  misc.validateQueryStringParam('configuration_value_qs', 'configurationId', {'id': configurationId}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    configurationOps.remove(req.ctx, configurationId, {}, callback);
  });
};
