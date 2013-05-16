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
var BatchInsert = require('cassandra-orm/lib/orm/batch_insert').BatchInsert;
var ObjectIterator = require('cassandra-orm/lib/orm/iterator').ObjectIterator;
var uuidFromTimestamp = require('rackspace-shared-utils/lib/uuid').uuidFromTimestamp;
var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;
var uuidStringFromTimestamp = require('rackspace-shared-utils/lib/uuid').uuidStringFromTimestamp;
var zkUtil = require('zookeeper-client/lib/util');
var instruments = require('rackspace-shared-utils/lib/instruments');
var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('db.ops.service');

var settings = require('../../util/settings');
var errors = require('../../util/errors');
var misc = require('../../util/misc');
var Service = require('../models/service').Service;
var LastServiceHeartbeat = require('../models/last_service_heartbeat').LastServiceHeartbeat;
var HeartbeatMarker = require('../models/heartbeat_marker').HeartbeatMarker;
var Event = require('../models/event').Event;
var heartbeatMarkerOps = require('./heartbeat_marker');
var eventOps = require('./event');
var accountOps = require('./account');
var getOne = require('./utils').getOne;
var getAll = require('./utils').getAll;
var getAllIndex = require('./utils').getAllIndex;
var activity = require('./activity');

/**
 * Return a timestamp of when the service was last heartbeated.
 *
 * @param {Function} callback Callback called with (err, timestamp).
 */
exports.getLastHeartbeatTimestamp = function(ctx, srvKey, options, callback) {
  exports.getLastHeartbeatTimestamps(ctx, [srvKey], options, function(err, result) {
    callback(null, (result) ? result[srvKey] : null);
  });
};

/**
 * Return a last heartbeat timestamps for the list of the provided servicekeys.
 *
 * @param {Function} callback Callback called with (err, {Object}result).
 */
exports.getLastHeartbeatTimestamps = function(ctx, srvKeys, options, callback) {
  var oi = new ObjectIterator(ctx, LastServiceHeartbeat), acKey = ctx.account.getKey(),
      result = {};

  // TODO: Fix a bug in ORM
  if (srvKeys.length === 0) {
    callback(null, result);
    return;
  }

  oi.on('error', callback);
  oi.on('object', function(obj) {
    result[obj.key] = obj.timestamp;
  });
  oi.on('end', function() {
    callback(null, result);
  });

  oi.getColumnListByKey(acKey, srvKeys, true);
};

exports.getOne = function(ctx, srvKey, options, callback) {
  var key = Service.prefix() + srvKey;

  options = options || {};
  options.includeChildren = false;
  options.stripKeyPrefix = true;

  async.waterfall([
    function rectifyServices(callback) {
      if (!options.rectify) {
        callback();
        return;
      }

      eventOps.rectifyServices(ctx, {}, callback);
    },

    function getService(callback) {
      async.parallel([
        getOne(Service).bind(null, ctx, ctx.account.getKey(), key, options),
        exports.getLastHeartbeatTimestamp.bind(null, ctx, key, {})
      ],

      function(err, results) {
        var srv, ts;

        if (err) {
          callback(err);
          return;
        }

        srv = results[0];
        ts = results[1];

        if (ts) {
          srv.last_seen = ts;
        }

        callback(null, srv);
      });
    }
  ], callback);
};

exports.getAll = function(ctx, options, callback) {
  var from = lowUUIDFromTimestamp(ctx.account.created_at),
      to = highUUIDFromTimestamp(new Date().getTime());

  options = options || {};
  options.includeChildren = false;
  options.usePaginationParams = true;

  async.waterfall([
    function rectifyServices(callback) {
      if (!options.rectify) {
        callback();
        return;
      }

      eventOps.rectifyServices(ctx, {}, callback);
    },

    function getServices(callback) {
      getAll(Service)(ctx, ctx.account.getKey(), Service.prefix(), null, options, callback);
    },

    function getLastSeens(results, metadata, callback) {
      var srvKeys = results.map(function(srv) { return srv.getKey(); });

      exports.getLastHeartbeatTimestamps(ctx, srvKeys, {}, function(err, values) {
        callback(err, results, metadata, values);
      });
    },

    function assignLastSeens(results, metadata, values, callback) {
      results.forEach(function(srv) {
        var srvKey = srv.getKey();

        if (values.hasOwnProperty(srvKey)) {
          srv.last_seen = values[srvKey];
        }
      });

      callback(null, results, metadata);
    }
  ], callback);
};

exports.getForTag = function(ctx, tag, options, callback) {
  var acKey = ctx.account.getKey();

  options = options || {};
  options.usePaginationParams = true;

  async.waterfall([
    function rectifyServices(callback) {
      if (!options.rectify) {
        callback();
        return;
      }

      eventOps.rectifyServices(ctx, {}, callback);
    },

    getAllIndex(Service).bind(null, ctx, acKey, tag, 'tags_idx', options, callback)
  ], callback);
};

exports.create = function(ctx, params, callback) {
  var key = Service.prefix() + params.key,
      zkClient = zkUtil.getClient(settings.ZOOKEEPER_CLUSTER),
      lockName = misc.getLockName('ops-create-service', ctx, key),
      bi = new BatchInsert(ctx, ctx.account.getKey());

  callback = zkUtil.wrapCallbackWithUnlock(ctx, zkClient, lockName, callback);

  async.waterfall([
    // We need to obtain a lock, because key is user-provided and not randomly
    // generated.
    zkClient.acquireLock.bind(zkClient, ctx, lockName, ctx.txnId),

    function getService(callback) {
      exports.getOne(ctx, params.key, {'rectify': true}, function(err, srv) {
        var msg;

        if (err) {
          if ((err instanceof errors.ObjectDoesNotExistError)) {
            callback();
            return;
          }

          callback(err);
          return;
        }

        msg = sprintf('Service with id %s already exists.', params.key);
        callback(new errors.ValidationError(msg));
      });
    },

    accountOps.checkLimit.bind(null, ctx, Service.meta.cname),

    function createServiceAndInsertEvent(callback) {
      var srv, ev, eventParams, eventPayload;

      if (!params.hasOwnProperty('_key')) {
        params._key = key;
      }

      srv = new Service(params);
      bi.save(srv);

      eventPayload = {
        'id': srv.getKeyWithoutPrefix(),
        'heartbeat_timeout': srv.heartbeat_timeout,
        'tags': params.tags || [],
        'metadata': params.metadata || {}
      };
      eventParams = {'timestamp': Date.now(),
                     'type': 'service.join',
                     'payload': eventPayload,
                     '_key': uuidFromTimestamp(Date.now()).toString()};
      ev = new Event(eventParams);
      bi.save(ev);
      callback(null, srv);
    },

    function insertInitialHeartbeatToken(srv, callback) {
      var hbm, nextToken;

      nextToken = exports.getNextHeartbeatToken(srv.heartbeat_timeout, Date.now());
      // TODO: Use a method which makes sure serice_id contains a prefix
      hbm = new HeartbeatMarker({'_key': nextToken, 'service_id': srv.getKey()});
      bi.save(hbm);
      callback(null, srv, hbm);
    },

    function commit(srv, hbm, callback) {
      bi.commit(function(err) {
        callback(err, srv, hbm);
      });
    },

    function asyncActivityUpdate(srv, hbm, callback) {
      activity.update(ctx, ctx.account.getKey(), Date.now());
      callback(null, srv, hbm);
    }
  ], callback);
};

exports.update = function(ctx, serviceId, params, callback) {
  var bi = new BatchInsert(ctx, ctx.account.getKey());

  async.waterfall([
    eventOps.rectifyServices.bind(null, ctx, {}),
    exports.getOne.bind(null, ctx, serviceId, {'rectify': false}),

    function update(srv, callback) {
      srv.mergeForUpdate(ctx, params, bi, callback);
    }
  ],

  function(err, srv) {
    if (err) {
      callback(err);
      return;
    }

    bi.commit(function(err) {
      if (!err) {
        // fire an asynchronous activity update.
        activity.update(ctx, ctx.account.getKey(), Date.now(), null);
      }
      callback(err, srv);
    });
  });
};

/**
 * Heartbeat a service.
 *
 * @param {Function} callback Callback called with (err, nextHeartbeatToken)
 */
exports.heartbeat = function(ctx, srvKey, token, callback) {
  var bi = new BatchInsert(ctx, ctx.account.getKey()),
      work = new instruments.Work('service_heartbeat'),
      fullSrvKey = Service.prefix() + srvKey;

  work.start();

  async.waterfall([
    function getServiceAndMarker(callback) {
      async.parallel([
        exports.getOne.bind(null, ctx, srvKey, {}),
        heartbeatMarkerOps.getOne.bind(null, ctx, token, {}),
      ],

      function(err, results) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, results[0], results[1]);
      });
    },

    function removeOldToken(srv, hbm, callback) {
      bi.removeObject(hbm, 'hard');
      callback(null, srv);
    },

    function insertNewToken(srv, callback) {
      var hbm, nextToken;

      nextToken = exports.getNextHeartbeatToken(srv.heartbeat_timeout, Date.now());
      hbm = new HeartbeatMarker({'_key': nextToken, 'service_id': fullSrvKey});
      bi.save(hbm);

      bi.commit(function(err) {
        callback(err, hbm);
      });
    },
  ],

  function(err, hbm) {
    work.stop(err);
    callback(err, hbm);

    // Those actions are 'atomic' and can happen in the background after
    // returning response to the user.
    // Note: If both of those actions used ORM they could re-use the same batch
    // insert.
    exports.updateLastHeartbeatTime(ctx, fullSrvKey, Date.now(), function() {});
    activity.update(ctx, ctx.account.getKey(), Date.now(), function() {});
  });
};

/**
 * Update the last heartbeat timestamp for the provided service.
 *
 * @param {String} key Service id.
 * @param {Number} timestamp Timestamp to use (in ms).
 * @param {Function} callback Callback called with (err);
 */
exports.updateLastHeartbeatTime = function(ctx, srvKey, timestamp, callback) {
  var bi, shb, params, acKey = ctx.account.getKey();

  // writeTimestamp uses microseconds
  bi = new BatchInsert(ctx, acKey, {'writeTimestamp': (timestamp * 1000)});
  params = {'_key': srvKey, 'timestamp': timestamp};
  shb = new LastServiceHeartbeat(params);
  bi.save(shb);
  bi.commit(callback);
};

/**
 * Remove a service and insert service.removed event.
 */
exports.remove = function(ctx, serviceId, callback) {
  var bi = new BatchInsert(ctx, ctx.account.getKey());

  async.waterfall([
    eventOps.rectifyServices.bind(null, ctx, {}),
    exports.getOne.bind(null, ctx, serviceId, {'rectify': false}),

    function removeServiceAndInsertEvent(srv, callback) {
      var shb, removedEvent, eventPayload;

      eventPayload = {
        'id': srv.getKeyWithoutPrefix(),
        'heartbeat_timeout': srv.heartbeat_timeout,
        'tags': srv.tags || [],
        'metadata': srv.metadata || {}
      };

      shb = new LastServiceHeartbeat({'_key': srv.getKey()});
      removedEvent = new Event({'_key': uuidFromTimestamp(Date.now()).toString(),
                                'timestamp': Date.now(),
                                'type': 'service.remove',
                                'payload': eventPayload});

      bi.removeObject(srv, 'hard');
      bi.removeObject(shb, 'hard');
      bi.save(removedEvent);

      bi.commit(function(err) {
        callback(err, srv);
      });
    }
  ], callback);
};

/**
 * Return heartbeat token for the next interval.
 *
 * @param {Number} heartbeatTimeout Heartbeat timeout (in seconds).
 * @param {Number} ts Timestamp (in ms) used in the calculation.
 * @return {String} heartbeat token for the next interval.
 */
exports.getNextHeartbeatToken = function(heartbeatTimeout, ts) {
  var nextTs, nextToken;

  nextTs = ts + (heartbeatTimeout * 1000);
  nextToken = uuidStringFromTimestamp(nextTs);

  return nextToken;
};
