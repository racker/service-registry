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
var swiz = require('swiz');
var log = require('logmagic').local('api.handlers.service');

var defs = require('../defs').defs;
var serviceOps = require('../../db/ops/service');
var common = require('./common');
var misc = require('../../util/misc');

exports.list = function(req, res) {
  var callback = common.swizListResponseCallback(req, res, {'stripKeyPrefix': true});

  log.debug('list', {request: req});
  req.time('service.list.http');

  if (req.query.hasOwnProperty('tag')) {
    misc.validateQueryStringParam('service', 'tag', {'id': req.query.tag}, function(err) {
      if (err) {
        callback(err);
        return;
      }

      serviceOps.getForTag(req.ctx, req.query.tag, {'rectify': true}, callback);
    });
  }
  else {
    serviceOps.getAll(req.ctx, {'rectify': true}, callback);
  }
};

exports.fetch = function(req, res) {
  var callback = common.swizResponseCallback(req, res, {'stripKeyPrefix': true}),
      serviceId = req.params.serviceId;

  log.debug('fetch', {request: req});
  req.time('service.fetch.http');

  misc.validateQueryStringParam('service', 'serviceId', {'id': serviceId}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    serviceOps.getOne(req.ctx, serviceId, {'rectify': true}, callback);
  });
};

exports.create = function(req, res) {
  var callback = common.createResponseCallback(req, res);

  log.debug('create', {request: req});
  req.time('service.create.http');

  async.waterfall([
    function validate(callback) {
      req.checkAndOnSuccess('service', null, function(cleaned) {
        callback(null, cleaned);
      });
    },

    serviceOps.create.bind(null, req.ctx),

    function serializeResponse(srv, hbm, callback) {
      serializeHeartbeatResponse(hbm, function(err, result) {
        callback(err, srv, result);
      });
    }
  ],

  function(err, srv, payload) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, srv, payload);
  });
};

exports.update = function(req, res) {
  var callback = common.updateResponseCallback(req, res),
      serviceId = req.params.serviceId;

  log.debug('update', {request: req});
  req.time('service.update.http');

  misc.validateQueryStringParam('service', 'serviceId', {'id': serviceId}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    req.checkAndOnPartialSuccess('service', null, function(cleaned) {
      serviceOps.update(req.ctx, serviceId, cleaned, callback);
    });
  });
};

exports.heartbeat = function(req, res) {
  var callback = common.swizResponseCallback(req, res, {'headers': {'connection': 'keep-alive'}});

  log.debug('heartbeat', {request: req});
  req.time('service.heartbeat.http');

  async.waterfall([
    function validate(callback) {
      req.checkAndOnSuccess('heartbeat', null, function(cleaned) {
        callback(null, cleaned.token);
      });
    },

    serviceOps.heartbeat.bind(null, req.ctx, req.params.serviceId),

    function formatResponse(hbm, callback) {
      var payload = {'token': hbm.getKey()};
      payload.getSerializerType = function() { return 'heartbeat'; };
      callback(null, payload);
    }
  ], callback);
};

exports.remove = function(req, res) {
  var callback = common.deleteResponseCallback(req, res),
      serviceId = req.params.serviceId;

  log.debug('remove', {request: req});
  req.time('service.remove.http');

  misc.validateQueryStringParam('service', 'serviceId', {'id': serviceId}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    serviceOps.remove(req.ctx, serviceId, callback);
  });
};

function serializeHeartbeatResponse(hbm, callback) {
  var payload, sw = new swiz.Swiz(defs, {'for': 'public', 'stripNulls': false}),
      sz = swiz.SERIALIZATION.SERIALIZATION_JSON;

  payload = {'token': hbm.getKey()};
  payload.getSerializerType = function() { return 'heartbeat'; };

  sw.serialize(sz, 1, payload, callback);
}
