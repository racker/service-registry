/**
 *  Copyright 2012 Rackspace
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

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var path = require('path');
var util = require('util');
var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var logmagic = require('logmagic');
var log = require('logmagic').local('service-registry-client');
var misc = require('rackspace-shared-utils/lib/misc');
var errors = require('rackspace-shared-utils/lib/errors');
var request = require('rackspace-shared-utils/lib/request');

var utils = require('./utils');

/**
 * Default API endpoint url.
 */
var DEFAULT_URL = 'https://dfw.registry.api.rackspacecloud.com/v1.0';

/**
 * How many times to retry a request if API server returns 401 aka token has
 * potentially expired.
 */
var MAX_401_RETRY_COUNT = 1;

/**
 * Library version.
 */
var VERSION = JSON.parse(fs.readFileSync(path.join(__dirname,
                                         '../package.json'))).version;

/**
 * User-agent header sent with every request.
 */
var USER_AGENT = 'node-service-registry-client/v' + VERSION;

/**
 * @constructor
 * @param {String} username API username.
 * @param {String} apiKey API key.
 * @param {?Object} options Options object with the following keys:
 * - url - full API url including a version/
 * - authUrl - auth api url.
 * - debug - true to enable debug mode and print log messages.
 * - raw - pass raw response to the function callback instead of parsing it.
 */
function BaseClient(username, apiKey, region, options) {
  var keystoneClientOptions;

  region = region || 'us';
  options = options || {};

  this._url = options.url || DEFAULT_URL;

  if (this._url.charAt(this._url.length - 1) === '/') {
    this._url = this._url.slice(0, this._url.length - 1);
  }

  this._username = username;
  this._apiKey = apiKey;
  this._region = region;
  this._logToConsole = options.logToConsole || false;
  this._options = options;
  this._authUrl = utils.getAuthUrl(options, region);

  if (options.keystoneClient) {
    this._client = options.keystoneClient;
  }
  else {
    keystoneClientOptions = {'username': username, 'apiKey': apiKey,
                             'cacheTokenFor': 600};
    this._client = utils.getKeystoneClient(authUrl, keystoneClientOptions, log);
  }
  if (this._logToConsole) {
    logmagic.route('service-registry-client.*', logmagic.DEBUG, 'console');
  }
}

util.inherits(BaseClient, EventEmitter);

BaseClient.prototype._request = function(path, method, payload, options, callback) {
  method = method || 'GET';
  payload = payload || null;
  options = options || {};
  var self = this, parseJson = !this._options.raw, retryCount = 0;

  function performRequest(refreshAuthToken) {
    self._client.getTenantIdAndToken({'refreshAuthToken': refreshAuthToken}, function(err, result) {
      var extraHeaders = options.headers || {}, expectedStatusCode = options.expectedStatusCode,
          qs = options.queryString || {}, reqOptions, defaultHeaders, url, headers, curlCmd,
          baseUrl = self._url, data = payload;

      if (err) {
        callback(err);
        return;
      }

      baseUrl += '/' + result.tenantId;

      defaultHeaders = {
        'X-Auth-Token': result.token,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json'
      };

      if (data) {
        data = JSON.stringify(data);
      }

      headers = misc.merge(defaultHeaders, extraHeaders);
      url = sprintf('%s%s', baseUrl, path);
      qs = querystring.stringify(qs);

      if (qs) {
        url += '?' + qs;
      }

      curlCmd = request.buildCurlCommand(url, method, headers, payload);
      log.tracef('curl command: ${cmd}', {'cmd': curlCmd});
      reqOptions = {
        'expected_status_codes': [expectedStatusCode],
        'return_response': true,
        'parse_json': parseJson,
        'headers': headers,
        'persistent': options.persistent
      };

      request.request(url, method, data, reqOptions, function(err) {
        if ((err instanceof errors.UnexpectedStatusCodeError) && (err.statusCode === 401) && (retryCount < MAX_401_RETRY_COUNT)) {
          retryCount++;
          performRequest(true);
          return;
        }

        callback.apply(null, arguments);
      });
    });
  }

  performRequest(false);
};

BaseClient.prototype._getIdFromUrl = function(url) {
  var split, id;

  split = url.split('/');
  id = split[split.length - 1];
  return id;
};

BaseClient.prototype._list = function(path, options, callback) {
  var response, self = this, nextMarker;
  options = options || {};
  options.queryString = options.queryString || {};
  options.expectedStatusCode = 200;

  if (options.marker) {
    options.queryString.marker = options.marker;
  }

  if (options.limit) {
    options.queryString.limit = options.limit;
  }

  this._request(path, 'GET', null, options, function(err, res) {
    if (err) {
      callback(err);
      return;
    }

    response = self._options.raw ? res : res.body.values;
    if (res.body && res.body.metadata && res.body.metadata.next_marker) {
      nextMarker = res.body.metadata.next_marker;
    }
    callback(null, response, nextMarker);
  });
};

BaseClient.prototype._get = function(path, options, callback) {
  var response, self = this;
  options = options || {};
  options.expectedStatusCode = 200;

  this._request(path, 'GET', null, options, function(err, res) {
    if (err) {
      callback(err);
      return;
    }

    response = self._options.raw ? res : res.body;
    callback(null, response);
  });
};

BaseClient.prototype._create = function(path, payload, options, callback) {
  options = options || {};
  options.expectedStatusCode = 201;
  this._request(path, 'POST', payload, options, function(err, res) {
    callback(err, res);
  });
};

BaseClient.prototype._update = function(path, payload, options, callback) {
  options = options || {};
  options.expectedStatusCode = 204;
  this._request(path, 'PUT', payload, options, function(err, res) {
    callback(err, res);
  });
};

BaseClient.prototype._remove = function(path, options, callback) {
  options = options || {};
  options.expectedStatusCode = 204;
  this._request(path, 'DELETE', null, options, function(err, res) {
    callback(err);
  });
};

exports.BaseClient = BaseClient;
