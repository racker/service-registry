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

var log = require('logmagic').local('lib.db.ops');
var cassErrors = require('cassandra-orm/lib/errors');
var cutils = require('cassandra-orm/lib/orm/utils');
var ObjectIterator = require('cassandra-orm/lib/orm/iterator').ObjectIterator;
var PaginatedIndexIterator = require('cassandra-orm/lib/orm/iterator').PaginatedIndexIterator;
var PaginatedObjectIterator = require('cassandra-orm/lib/orm/iterator').PaginatedObjectIterator;
var misc = require('rackspace-shared-utils/lib/misc');

var errors = require('../../util/errors');


/**
 * Retrieve last object in a row.
 */
exports.getLastObject = function getLastObject(Obj) {
  return function getLastObjectClosure(ctx, rowKey, callback) {
    var oi = new ObjectIterator(ctx, Obj);
    oi.getLastObject(rowKey, callback);
  };
};

exports.getAll = function getAll(Obj) {
  return function getAllClosure(ctx, key, starting, ending, options, callback) {
    var iter, iterOptions = {}, result = [], includeChildren, marker, tmp;

    if (!options.hasOwnProperty('includeChildren')) {
      includeChildren = true;
    }
    else {
      includeChildren = options.includeChildren;
    }

    tmp = exports.getIterOptions(Obj, ctx, starting, options);

    if (tmp.starting) {
      starting = tmp.starting;
    }

    iterOptions.limit = tmp.limit;
    iterOptions = misc.merge(iterOptions, options);

    iter = new PaginatedObjectIterator(ctx, Obj, iterOptions);

    iter.on('error', callback);

    iter.on('object', function iterOnObject(obj) {
      result.push(obj);
    });

    iter.on('end', function iterOnEnd(data) {
      callback(null, result, data);
    });

    iter.getSliceByKey(key, includeChildren, starting, ending);
  };
};

/**
 * Retrieve a single object within an account of a particular type.
 * @param {Object} Obj the object type.
 * @return {Function} dbobj specific accessor.
 */
exports.getOne = function getOne(Obj) {
  /**
   * Retrieve a single object within an account of a particular type.
   * @param {Object} ctx Operation context.
   * @param {String} rowKey Row key.
   * @param {String} objKey Object primary key.
   * @param {Object} options Optional options object.
   * @param {Function} callback A callback called with (err, object).
   */
  return function getOneClosure(ctx, rowKey, objKey, options, callback) {
    options = options || {};
    var objPrefix = Obj.prefix(), validKey, errOptions = {};

    if (options.hasOwnProperty('stripKeyPrefix')) {
      errOptions.stripKeyPrefix = options.stripKeyPrefix;
      delete options.stripKeyPrefix;
    }

    if (!objKey) {
      // objKey must always be provided
      callback(new cassErrors.InvalidKeyPrefixError(Obj, objKey));
      return;
    }

    // Ensure that the key prefix is valid
    validKey = cutils.isValidKey(Obj, objKey);
    if (!validKey) {
      callback(new errors.ObjectDoesNotExistError(Obj, objKey, errOptions));
      return;
    }

    exports.getAll(Obj)(ctx, rowKey, objKey, objKey, options, function getOneClosureHandler(err, results) {
      if (err) {
        callback(err);
        return;
      }

      if (!results || results.length === 0) {
        callback(new errors.ObjectDoesNotExistError(Obj, objKey, errOptions));
        return;
      }

      if (results.length === 1) {
        callback(null, results[0]);
      }
      else {
        log.error('Requested a single object, but multiple objects have been returned',
                  {'ctx': ctx, 'type': Obj.meta.name, 'objKey': objKey, 'returned': results.length});
        callback(new errors.MultipleObjectsReturnedError(Obj, objKey, results.length));
      }
    });
  };
};

/**
 * Retrive a subset of objects within an account of a particular type.
 * @param {Object} Obj the object type.
 * @return {Function} dbobj specific accessor. allows you to specify a start and stop key.
 */
exports.getSome = function getSome(Obj) {
  /**
   * Retrieve all the objects within an account of a particular type.
   * @param {Object} ctx Operation context.
   * @param {String} key Key of the object to retrieve.
   * @param {Boolean} includeChildren Include children objects.
   * @param {String} starting A prefix to natively filter on. Think: startsWith.
   * @param {String} ending A prefix to stop filtering on.
   * @param {Object} options Options hash.
   * @param {Function} callback A callback called with (err, results).
   */
  return function getSomeClosure(ctx, key, includeChildren, starting, ending, options, callback) {
    options = options || {};

    if (!key) {
      throw new errors.ValidationFailureError('key is not specified');
    }

    var result = [], iter, iterOptions = {}, tmp;

    tmp = exports.getIterOptions(Obj, ctx, starting, options);

    if (tmp.starting) {
      starting = tmp.starting;
    }

    iterOptions.limit = tmp.limit;
    iterOptions = misc.merge(iterOptions, options);

    iter = new PaginatedObjectIterator(ctx, Obj, iterOptions);

    iter.on('error', callback);
    iter.on('object', function iterOnObject(obj) {
      result.push(obj);
    });

    iter.on('end', function iterOnEnd(data) {
      callback(null, result, data);
    });

    iter.getSliceByKey(key, includeChildren, starting, ending);
  };
};

/**
 * Use the iterator to return an accessor with callback accessibility.
 * @param {DBBase} Obj the object definition.
 * @return {Function} db specific accessor.
 */
exports.getAllIndex = function getAllIndex(Obj) {
  return function getAllIndexClosure(ctx, rowKey, key, indexName, options, callback) {
    options = options || {};

    var result = [], limit, iter, iterOptions = {}, marker, tmp;

    tmp = exports.getIterOptions(Obj, ctx, key, options);

    if (tmp.starting) {
      iterOptions.starting = cutils.compoundColumn([ctx.account.getKey(), tmp.starting]);
    }

    iter = new PaginatedIndexIterator(ctx, Obj, rowKey, {'limit': tmp.limit, 'clean': options.clean});

    iter.on('error', callback);
    iter.on('object', function iterObject(obj) {
      result.push(obj);
    });

    iter.on('end', function iterEnd(data) {
      callback(null, result, data);
    });

    iter.getIndex(indexName, key, iterOptions);
  };
};

/**
 * Return options object which keys can be passed to iterator options.
 *
 * @param {Object} Obj Used database model.
 * @param {Object} ctx Operation context.
 * @param {String} starting A prefix to natively filter on. Think: startsWith.
 * @param {Object} options Options passed to getAll / getSome / getAllIndex.
 * @return {Object}
 */
exports.getIterOptions = function(Obj, ctx, starting, options) {
  var marker, result = {};

  if (options.usePaginationParams && ctx.pagination) {
    if (ctx.pagination.limit) {
      result.limit = ctx.pagination.limit;
    }

    if (ctx.pagination.marker) {
      // TODO: Add _stripPrefix to object meta data.
      if (Obj.prefix() && ctx.pagination.marker.indexOf(Obj.prefix()) !== 0) {
        marker = Obj.prefix() + ctx.pagination.marker;
      }
      else {
        marker = ctx.pagination.marker;
      }

      result.starting = cutils.getFullKeyFromMarker(Obj, marker, starting);
    }
  }

  return result;
};
