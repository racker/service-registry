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
var log = require('logmagic').local('lib.middleware.request.rate_limiting');

var sprintf = require('../../util/sprintf').sprintf;
var client = require('../../db').getClient();
var config = require('../../util/config').config;
var misc = require('../../util/misc');
var errors = require('../../util/errors');
var ProxyError = require('../../util/errors').ProxyError;
var httpUtil = require('../../util/http');


/**
 * Cache of compiled regular expressions.
 * @type {Object}
 */
var REGEX_CACHE = {};


/**
 * Calculate bucket key names for a rate limiting rule.
 *
 * @oaram {String} id User id.
 * @oaram {Object} rule Rate limiting rule.
 * @param {Function} callback Callback called with (err, keys).
 */
function calculateBucketKeyNames(id, rule, callback) {
  var settings = config.middleware.rate_limiting,
      now = misc.getUnixTimestamp(), keys = [], key, bucketCount, tmp, startTs, endTs, ts;

  bucketCount = (now / settings.bucket_size) | 0;
  tmp = (rule.period / settings.bucket_size) | 0;
  startTs = ((bucketCount - tmp) * settings.bucket_size) | 0;
  endTs = (bucketCount * settings.bucket_size);

  for (ts = startTs; ts < endTs; ts = (ts + settings.bucket_size)) {
    key = sprintf('rate_limits:%s:%s_%s:%s', id, rule.path_regex, rule.period, ts);
    keys.push(key);
  }

  callback(null, keys);
}


/**
 * Retrieve current usage.
 *
 * @param {Array} keys Bucket keys.
 * @param {Function} callback Callback called with (err, keys, bucketNameToValueMap).
 */
function getCurrentUsage(keys, callback) {
  client.getCounters(keys, function(err, values) {
    var usage = 0, bucketNameToValueMap = {}, i, key, value;

    if (err) {
      callback(err);
      return;
    }

    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      value = values[i] || 0;
      value = parseFloat(value);
      bucketNameToValueMap[key] = value;

      usage += value;
    }

    callback(null, keys, usage, bucketNameToValueMap);
  });
}


/**
 * Retrieve limit overrides for the provider user id and path regex.
 *
 * @param {String} id user id.
 * @param {String} pathRegex Path regular expression rule.
 * @param {Function} callback Callback called with (err, value).
 */
function getLimitOverrides(id, pathRegex, callback) {
  var key = sprintf('rate_limit_overrides:%s:%s', id, pathRegex);
  client.get(key, function(err, value) {
    if (err) {
      callback(err);
      return;
    }

    if (value) {
      value = parseInt(value, 10);
    }

    callback(null, value);
  });
}


/**
 * Check and update user rate limits.
 *
 * @param {String} id user id.
 * @param {Object} rule Rate limiting rule.
 * @param {Function} callback Callback called with (err).
 */
function checkAndUpdateLimit(id, rule, callback) {
  var settings = config.middleware.rate_limiting, currentUsage = 0;

  async.waterfall([
    calculateBucketKeyNames.bind(null, id, rule),
    getCurrentUsage,

    function getOverrides(keys, usage, bucketNameToValueMap, callback) {
      getLimitOverrides(id, rule.path_regex, function(err, value) {
        var limit = rule.limit;

        if (err) {
          callback(err);
          return;
        }

        if (value) {
          limit = value;
        }

        callback(null, keys, usage, bucketNameToValueMap, limit);
      });
    },

    function checkUsageAgainstLimit(keys, usage, bucketNameToValueMap, limit, callback) {
      currentUsage = usage;

      if (currentUsage >= limit) {
        rule.limit = limit;
        log.debug('Limit has been reached', {'usage': currentUsage, 'limit': limit});
        callback(new errors.RateLimitReachedError(rule));
        return;
      }

      callback(null, keys, bucketNameToValueMap);
    },

    function updateUsage(keys, bucketNameToValueMap, callback) {
      var currentBucketKey = keys[keys.length - 1], value = bucketNameToValueMap[currentBucketKey];
      // Update counter for the currently active bucket
      client.incr(currentBucketKey, {'step': 1, 'ttl': settings.bucket_size}, function(err) {
        if (err) {
          callback(err);
          return;
        }

        currentUsage++;
        callback();
      });
    }
  ],

  function(err) {
    callback(err, currentUsage);
  });
}

/**
 * Retrieve usage for a user for all the rules.
 *
 * @param {String} id User id.
 * @param {String} callback Callback called with (err, {Array}result).
 */
exports.getUsage = function(id, callback) {
  var settings = config.middleware.rate_limiting, result = [];

  async.forEach(settings.limits, function(rule, callback) {
    async.waterfall([
      calculateBucketKeyNames.bind(null, id, rule),
      getCurrentUsage,

      function getOverrides(keys, usage, bucketNameToValueMap, callback) {
        getLimitOverrides(id, rule.path_regex, function(err, value) {
          var limit = rule.limit;

          if (err) {
            callback(err);
            return;
          }

          if (value) {
            limit = value;
          }

          callback(null, usage, limit);
        });
      },

      function formatResult(usage, limit, callback) {
        result.push({'method': rule.method, 'path_regex': rule.path_regex,
                     'limit': limit, 'used': usage, 'period': rule.period});
        callback();
      }
    ], callback);
  },

  function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, result);
  });
};

exports.dependencies = ['identity_provider'];

if (config.target.middleware_run_list.request.indexOf('tracing') !== -1) {
  exports.dependencies.push('tracing');
}

exports.processRequest = function(req, res, callback) {
  var settings = config.middleware.rate_limiting, method = req.method,
      reachedLimitErrors = [], parsed = url.parse(req.url), pathName = parsed.pathname, childTrace;

  req.activeLimits = [];

  if (!req.userId) {
    log.debug('User id not provided, skipping rate limiting...');
    callback();
    return;
  }

  async.waterfall([
    function getLimits(callback) {
      // TODO: Cache it
      var pathRe = new RegExp(settings.usage_proxy_path), result = pathRe.exec(pathName);

      if (!(result && req.method === 'GET')) {
        callback();
        return;
      }

      // User requested a special URL, send raw usage data to the backend
      log.debug('User requested a special usage path, sending usage to the backend...', {'url': req.url});

      exports.getUsage(req.userId, function(err, data) {
        if (err) {
          callback(err);
          return;
        }

        data = JSON.stringify(data);

        if (result.length > 1) {
          // Replace placeholders in the target patch
          parsed.pathname = misc.replacePlaceholders(result, settings.usage_target_path, 1);
        }
        else {
          parsed.pathname = settings.usage_target_path;
        }

        req.method = 'POST';
        req.url = url.format(parsed);

        req.headers['Conent-Type'] = 'application/json';
        req.headers['Content-Length'] = Buffer.byteLength(data, 'utf8');

        req.emit('data', data);
        callback();
      });
    },

    function checkAndUpdateLimits(callback) {
      var serverRecvTrace, tryfer, ep;

      if (req.tracing) {
        serverRecvTrace = req.tracing.serverRecvTrace;
        childTrace = serverRecvTrace.child('check and update limits');
        tryfer = req.tracing.tryfer;
        ep = new tryfer.trace.Endpoint(serverRecvTrace.endpoint.ipv4,
                                       serverRecvTrace.endpoint.port,
                                       sprintf('%s:rproxy:rate_limiting', req.tracing.prefix));

        childTrace.setEndpoint(ep);
        childTrace.record(tryfer.trace.Annotation.clientSend());
        childTrace.record(tryfer.trace.Annotation.string('backend', config.database.backend));
      }

      async.forEach(settings.limits, function(rule, callback) {
        var regex;

        if (!REGEX_CACHE.hasOwnProperty(rule.path_regex)) {
          REGEX_CACHE[rule.path_regex] = new RegExp(rule.path_regex);
        }

        regex = REGEX_CACHE[rule.path_regex];

        // TODO: More efficient based on the database backend and less
        // round-trips
        if ((rule.method === method || rule.method === 'ALL') && regex.test(req.url)) {
          log.debug('URL matches a rate limited path, updating and checking limits...',
                    {'url': req.url, 'method': method, 'path_regex': rule.path_regex});

          checkAndUpdateLimit(req.userId, rule, function(err, used) {
            if (err && (err instanceof errors.RateLimitReachedError)) {
              reachedLimitErrors.push(err);
              err = null;
            }

            req.activeLimits.push({'regex': rule.path_regex, 'limit': rule.limit,
                                   'period': rule.period, 'available': (rule.limit - used),
                                   'used': used});

            callback(err);
          });
        }
        else {
          callback();
        }
      },

      function(err) {
        if (req.tracing) {
          childTrace.record(req.tracing.tryfer.trace.Annotation.clientRecv());
        }

        if (err) {
          callback(err);
          return;
        }

        if (reachedLimitErrors.length >= 1) {
          err = reachedLimitErrors[0];
          callback(new ProxyError(2000, err.message));
          return;
        }

        callback();
      });
    }
  ], callback);
};
