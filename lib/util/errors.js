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

var util = require('util');

var sprintf = require('sprintf').sprintf;

/**
 * An error class which represents a Valve validation error.
 * @constructor
 *
 * @param {ValveError} err Valve error object.
 */
function ValveValidationError(err) {
  var key = this._buildKeyName(err.parentKeys, err.key);

  this.key = err.key;
  this.parentKeys = err.parentKeys;
  this.details = err.message;

  this.message = sprintf('Validation error for key \'%s\'', key);
  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(ValveValidationError, Error);

/**
 * Build a full key name including any parent.
 * For example: parentKeys: ['details'], key: 'url' -> details.url
 *
 * @param {Array} parentKeys Parent keys.
 * @param {String} key Key name.
 * @return {String} full key name.
 */
ValveValidationError.prototype._buildKeyName = function(parentKeys, key) {
  var i, len = (parentKeys) ? parentKeys.length : 0, parentKey,
      keyName = '';

  if (!parentKeys || (parentKeys && len === 0)) {
    return key;
  }

  for (i = 0; i < len; i++) {
    parentKey = parentKeys[i];
    keyName += parentKey + '.';
  }

  keyName += key;
  return keyName;
};

/**
 * An error class which represents a Valve validation error which happened when
 * validating a query string parameter.
 * @constructor
 *
 * @param {String} parameter Name of the paramaeter where the error occured.
 * @param {ValveError} err Valve error object.
 */
function ValveQueryStringValidationError(parameter, err) {
  var key = this._buildKeyName(err.parentKeys, err.key);

  this.key = err.key;
  this.parentKeys = err.parentKeys;
  this.details = err.message;

  this.message = sprintf("Invalid value for '%s' query string parameter", parameter);
  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(ValveQueryStringValidationError, ValveValidationError);

/**
 * An error class which represents a validation error.
 * @constructor
 *
 * @param {String} message Error message.
 */
function ValidationError(message) {
  this.message = message;

  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(ValidationError, Error);


/**
 * Error which represents that we have corrupted data stored in the database.
 * We were expected a single object, but more then one has been returned.
 * @constructor
 *
 * @param {Object} type Object type.
 * @param {String} key Object key.
 * @param {Number} len Number of returned objects.
 */
function MultipleObjectsReturnedError(type, key, len) {
  this.objType = type;
  this.objKey = key;
  this.len = len;
  this.message = sprintf('Request one "%s" object, but got %s back!',
                         this.objType.meta.name, len);
  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(MultipleObjectsReturnedError, Error);

/**
 * Error which is used when an object doesn't exist.
 * @constructor
 *
 * @param {Object} type the db type (e.g. Entity, MonitoringZone, ...).
 * @param {String} key the lookup key.
 * @param {Object} options Options object with the following keys:
 * - stripKeyPrefix - true to strip Object prefix from the key
 */
function ObjectDoesNotExistError(type, key, options) {
  options = options || {};
  var stripKeyPrefix = options.stripKeyPrefix || false;

  this.objType = type;
  this.objKey = (stripKeyPrefix) ? key.replace(type.prefix(), '') : key;
  this.message = sprintf('Object "%s" with key "%s" does not exist',
                         this.objType.meta.name, this.objKey);
  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(ObjectDoesNotExistError, Error);

/**
 * An error class which represents that a resource limit has been reached.
 * @constructor
 *
 * @param {String} resource Resource name.
 * @param {Number} limit A limit.
 */
function LimitReachedError(resource, limit) {
  this.resource = resource;
  this.limit = limit;
  this.message = sprintf('Limit for resource %s has been reached. Maximum allowed objects: %d',
                         resource, limit);

  Error.call(this, this.message);
  Error.captureStackTrace(this, this.constructor);
}

util.inherits(LimitReachedError, Error);

/**
 * A base class which used for short-circuiting async chains.
 * @constructor.
 */
function AsyncShortCircuitError() {}

util.inherits(AsyncShortCircuitError, Error);

exports.ValveValidationError = ValveValidationError;
exports.ValveQueryStringValidationError = ValveQueryStringValidationError;
exports.ValidationError = ValidationError;
exports.MultipleObjectsReturnedError = MultipleObjectsReturnedError;
exports.ObjectDoesNotExistError = ObjectDoesNotExistError;
exports.AsyncShortCircuitError = AsyncShortCircuitError;
exports.LimitReachedError = LimitReachedError;
