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

var async = require('async');
var log = require('logmagic').local('lib.middleware.request.authentication');
var sprintf = require('sprintf').sprintf;

var client = require('../../db').getClient();
var config = require('../../util/config').config;
var request = require('../../util/request').request;
var misc = require('../../util/misc');
var httpUtil = require('../../util/http');
var ProxyError = require('../../util/errors').ProxyError;
var KeystoneClient = require('keystone-client').KeystoneClient;


/**
 * Extra headers which are send to the backend in case of error.
 */
var EXTRA_RESPONSE_HEADERS = {
  'x-rp-www-authenticate': config.middleware.authentication.urls.map(function(url) {
    return sprintf('Keystone uri="%s"', url);
  })
};


/**
 * Middleware for authenticating against the Rackspace Cloud Auth API.
 *
 * If a valid token is provided is also cached in Redis until it expires.
 */
function cacheToken(cacheKey, tenantId, token, expires, callback) {
  var expiresTs = misc.dateStrToUnixTimestamp(expires),
      nowTs = new Date().getTime() / 1000,
      ttl = Math.round((expiresTs - nowTs)),
      data = {
        'token': token,
        'tenantId': tenantId
      };

  if (ttl < 1) {
    log.debug('Token already expired, not caching it...');
    callback();
    return;
  }

  log.debug('Caching new auth token', {'tenantId': tenantId, 'expires': expires, 'ttl': ttl});
  client.set(cacheKey, data, {'ttl': ttl}, callback);
}

function verifyToken(req, tenantId, token, callback) {
  var settings = config.middleware.authentication,
      clientOptions = {'username': settings.username, 'password': settings.password},
      clientParams, result = {};

  clientParams = settings.urls.map(function(url)  {
    return {'url': url, 'options': clientOptions};
  });

  async.some(clientParams, function(params, callback) {
    var client = new KeystoneClient(params.url, params.options),
        serverRecvTrace, childTrace, ep, tryfer;

    if (req.tracing) {
      serverRecvTrace = req.tracing.serverRecvTrace;
      childTrace = serverRecvTrace.child('validate token');
      tryfer = req.tracing.tryfer;
      ep = new tryfer.trace.Endpoint(serverRecvTrace.endpoint.ipv4,
                                     serverRecvTrace.endpoint.port,
                                     sprintf('%s:rproxy:auth', req.tracing.prefix));

      childTrace.setEndpoint(ep);
      childTrace.record(tryfer.trace.Annotation.clientSend());
      childTrace.record(tryfer.trace.Annotation.string('rax.auth_url', params.url));
    }

    client.validateTokenForTenant(tenantId, token, function(err, data) {
      if (req.tracing) {
        childTrace.record(tryfer.trace.Annotation.clientRecv());
      }

      if (err) {
        log.error('Auth service returned an error', {'url': params.url, 'err': err});
        callback(false);
        return;
      }

      if (!err && data) {
        log.debug('Auth service returned that a token is valid', {'url': params.url});
        result.expires = data.token.expires;
        callback(true);
      }
    });
  },

  function(valid) {
    if (!valid) {
      callback(new ProxyError(1002, 'Invalid or expired authentication token', EXTRA_RESPONSE_HEADERS));
      return;
    }

    callback(null, result);
  });
}

exports.dependencies = ['identity_provider'];

if (config.target.middleware_run_list.request.indexOf('tracing') !== -1) {
  exports.dependencies.push('tracing');
}

exports.processRequest = function(req, res, callback) {
  var settings = config.middleware.authentication, tenantId = req.userId, cacheKey, whitelist, token,
      parsed = url.parse(req.url, true), query = parsed.query || {}, pathName = parsed.pathname, skipCache;

  whitelist = settings.whitelist || [];
  token = (query.hasOwnProperty('x-auth-token')) ? query['x-auth-token'] : req.headers['x-auth-token'];
  skipCache = query['skip-auth-cache'];

  if (whitelist.indexOf(pathName) !== -1) {
    log.debug('Whitelisted path, skipping authentication...', {'path': pathName});
    callback();
    return;
  }

  if (!tenantId) {
    callback(new ProxyError(1000, 'No tenant id provided', EXTRA_RESPONSE_HEADERS));
    return;
  }

  if (!token) {
    callback(new ProxyError(1001, 'No authentication token provided', EXTRA_RESPONSE_HEADERS));
    return;
  }

  cacheKey = 'auth-token-' + token + '-' + tenantId;

  async.waterfall([
    function getTokenFromCache(callback) {
      if (skipCache) {
        callback(null, null);
        return;
      }

      client.get(cacheKey, callback);
    },

    function maybeVerifyToken(data, callback) {
      if (data) {
        log.debug('Token already in the cache, skipping verification via API server...');
        callback(null, null);
        return;
      }

      if (skipCache) {
        log.debug('?skip-auth_cache query string provided, skipping auth cache...');
      }
      else {
        log.debug('Token not in cache, verifying it against the keystone API...');
      }

      verifyToken(req, tenantId, token, callback);
    },

    function maybeCacheToken(result, callback) {
      if (!result) {
        // Token is already in the cache.
        callback();
        return;
      }

      cacheToken(cacheKey, tenantId, token, result.expires, callback);
    }
  ], callback);
};
