/**
 *  Copyright 2012 Tomaz Muraus
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

var url = require('url');

var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('lib.middleware.response.rate_limiting');

var client = require('../../db').getClient();
var misc = require('../../util/misc');
var httpUtil = require('../../util/http');
var config = require('../../util/config').config;
var rateLimitingMiddleware = require('../request/rate_limiting');

exports.dependencies = [];

if (config.target.middleware_run_list.response.indexOf('tracing') !== -1) {
  exports.dependencies.push('tracing');
}

exports.registerAdminEndpoints = function(app) {
  // Retrieve use and limits data for a user
  app.get('/usage', function(req, res) {
    var parsed = url.parse(req.url, true), userId;

    userId = parsed.query.userId;

    if (!userId) {
      log.debug('Missing required parameter', {'userId': userId});
      httpUtil.returnError(res, 400, 'Missing one of the required parameters (userId)');
      return;
    }

    rateLimitingMiddleware.getUsage(userId, function(err, result) {
      if (err) {
        httpUtil.returnError(res, 500, err.message);
        return;
      }

      httpUtil.returnJson(res, 200, result);
    });
  });

  // Override user limits
  app.post('/limits', function(req, res) {
    var parsed = url.parse(req.url, true), userId, pathRegex, value, key;

    userId = parsed.query.userId;
    pathRegex = parsed.query.pathRegex;
    value = parsed.query.value;

    if (!userId || !pathRegex || !value) {
      log.debug('Missing required parameter', {'userId': userId, 'pathRegex': pathRegex, 'value': value});
      httpUtil.returnError(res, 400, 'Missing one of the required parameters (userId, pathRegex, value)');
      return;
    }

    log.debug('Overriding user limits', {'userId': userId, 'pathRegex': pathRegex, 'value': value});

    key = sprintf('rate_limit_overrides:%s:%s', userId, pathRegex);
    client.set(key, value, null, function(err) {
      if (err) {
        httpUtil.returnError(res, 400, err.message);
        return;
      }

      httpUtil.returnJson(res, 200, {});
    });
  });
};

exports.processResponse = function(req, res, callback) {
  var item, now = misc.getUnixTimestamp();

  // Inject usage / limits headers
  if (req.activeLimits && req.activeLimits.length >= 1) {
    req.activeLimits.sort(function(a, b) {
      return (a.available - b.available);
    });

    item = req.activeLimits[0];

    res.headers['X-Ratelimit-Path-Regex'] = item.regex;
    res.headers['X-Ratelimit-Limit'] = item.limit;
    res.headers['X-Ratelimit-Used'] = item.used;
    res.headers['X-Ratelimit-Window'] = item.period + ' seconds';
    res.headers['Reply-After'] = (now + item.period);
  }

  callback();
};
