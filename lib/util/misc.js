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

var crypto = require('crypto');

var sprintf = require('sprintf').sprintf;
var cassLog = require('logmagic').local('ele.cassandra');
var cassErrorLog = require('logmagic').local('ele.cassandra-error');
var cassCqlLog = require('logmagic').local('ele.cassandra-cql');
var cassTimeLog = require('logmagic').local('ele.cassandra-timing');
var cassInitialize = require('cassandra-orm/lib/init').initialize;
var cutils = require('cassandra-orm/lib/orm/utils');
var Valve = require('swiz').Valve;

var settings = require('./settings');
var validity = require('../public_api/defs').validity;
var ValveQueryStringValidationError = require('./errors').ValveQueryStringValidationError;

/**
 * Log cassandra message.
 *
 * @param {String} level Log level.
 * @param {String} message Message.
 * @param {Object} obj Log object.
 */
exports.logCassEvent = function logCassEvent(level, message, obj) {
  obj = obj || {};

  if (level === 'error') {
    if (obj.connectionInfo) {
      obj.cass_host = obj.connectionInfo.host;
      obj.cass_port = obj.connectionInfo.port;
    }

    cassErrorLog.error(message, obj);
  } else if (level === 'info') {
    cassLog.info(message, obj);
  } else if (level === 'warn') {
    cassLog.warn(message, obj);
  } else if (level === 'cql') {
    if (settings.SHOW_CQL) {
      cassCqlLog.info('CQL QUERY: ' + obj.parameterized_query, cutils.rightLogObject(obj));
    }
    else {
      cassCqlLog.trace('CQL QUERY', cutils.rightLogObject(obj));
    }
  }
  else if (level === 'timing') {
    cassTimeLog.trace('CQL TIMING', cutils.rightLogObject(obj));
  }
  else if (level === 'trace') {
    cassLog.trace(message, obj);
  }
  else {
    cassLog.debug(message, obj);
  }
};

/**
 * Parse an object id from the location header url.
 *
 * @param {String} url URL to parse the id from.
 */
exports.getIdFromUrl = function(url) {
  var split, id;

  split = url.split('/');
  id = split[split.length - 1];
  return id;
};


/**
 * Validate a query string parameter using swiz definitions.
 *
 * @param {String} type Swiz definition name.
 * @param {String} parameter Name of the query string paramater being validated.
 * @param {Object} obj Object to validate.
 * @param {Function} callback A callback fired with (err, cleaned).
 */
exports.validateQueryStringParam = function(type, parameter, obj, callback) {
  var v = new Valve(validity[type]);

  v.checkPartial(obj, function(err, cleaned) {
    if (err) {
      err = new ValveQueryStringValidationError(parameter, err);
    }

    callback(err, cleaned);
  });
};

/**
 * Return a lock name which is prefixed with the account id.
 *
 * @param {String} prefix Lock name prefix.
 * @param {DbOperationContext} ctx Operation context.
 * @param {String} value Value which is appended to the prefix (e.g. lock name).
 */
exports.getLockName = function(prefix, ctx, value) {
  var name, hash, result;

  name = sprintf('%s-%s', prefix, value);
  hash = crypto.createHash('md5').update(name).digest('hex');
  result = sprintf('%s-%s', ctx.account.getKey(), hash);

  return result;
};
