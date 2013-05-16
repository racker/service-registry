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

var log = require('logmagic').local('api.utils');

var fault = require('./fault');
var ErrorResponse = require('./responses').ErrorResponse;
var ValidationError = require('../util/errors').ValidationError;
var ValveValidationError = require('../util/errors').ValveValidationError;

exports.errHandlerFunc = function(req, res) {
  return function(err) {
    var re;

    log.debug('Validation error', {'err': err});

    if (err instanceof Error) {
      re = new ErrorResponse(new ValidationError(err.message));
    }
    else {
      re = new ErrorResponse(new ValveValidationError(err));
    }

    re.perform(req, res);
    return;
  };
};

exports.unknownErrHandlerFunc = function(err, req, res, next) {
  var resp;

  log.err(err.message, {'request': req, 'url': req.url, 'method': req.method,
                        'full_message': err.stack});

  if (err instanceof URIError) {
    resp = new ErrorResponse(fault.badRequest(err.message));
  }
  else {
    resp = new ErrorResponse(err, '', '');
  }

  resp.perform(req, res);
};


/**
 * Return a namespace and key for the provided path.
 *
 * Note: This function doesn't perform any validation and assumes valid path is
 * passed in (no double slashes, leading slash is present, trailing slash is
 * present if no key is provided, etc).
 *
 * Examples (in -> out):
 *
 * - /production/cassandra/ -> /production/cassandra, null
 * - /production/cassandra -> /production, cassandra
 * - /production/cassandra/listen_ip -> /production/cassandra, listen_ip
 *
 * @return {Object} Object with the following keys: namespace, key
 */
exports.getNamespaceAndKeyFromPath = function(path) {
  var split = path.split('/'), result = {'namespace': null, 'key': null};

  if (split.length >= 3) {
    result.namespace = '/' + split.slice(1, split.length - 1).join('/');
  }

  if (path.charAt(path.length - 1) !== '/') {
    // Trailing slash is here, assume key is provided.
    result.key = split[split.length - 1];
  }

  return result;
};
