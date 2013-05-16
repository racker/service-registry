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
var log = require('logmagic').local('db.ops.event');
var BatchInsert = require('cassandra-orm/lib/orm/batch_insert').BatchInsert;
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;
var highUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').highUUIDFromTimestamp;
var uuidFromString = require('rackspace-shared-utils/lib/uuid').uuidFromString;
var instruments = require('rackspace-shared-utils/lib/instruments');

var Service = require('../models/service').Service;
var Event = require('../models/event').Event;
var HeartbeatMarker = require('../models/heartbeat_marker').HeartbeatMarker;
var LastServiceHeartbeat = require('../models/last_service_heartbeat').LastServiceHeartbeat;
var serviceOps = require('./service');
var getOne = require('./utils').getOne;
var getSome = require('./utils').getSome;
var AsyncShortCircuitError = require('../../util/errors').AsyncShortCircuitError;
var metadata = require('../ops/metadata');

/**
 * Retrieve a single event.
 *
 * @param {Object} ctx Context object.
 * @param {String} key Event key (time uuid).
 */
exports.getOne = function(ctx, key, options, callback) {
  options.includeChildren = false;
  getOne(Event)(ctx, ctx.account.getKey(), key, options, callback);
};

/**
 * Retrieve a time slice of events.
 *
 * @param {Object} ctx Context object.
 * @param {String} from Start time uuid (inclusive).
 * @param {String} to End uuid (inclusive).
 * @param {String} type Only return events with the specified type.
 * @param {?Object} options Options object.
 * @param {Function} Callback Callback called with (err, res, metadata).
 */
exports.getTimeSlice = function(ctx, from, to, type, options, callback) {
  async.waterfall([
    exports.rectifyServices.bind(null, ctx, options),

    function getEvents(callback) {
      options.usePaginationParams = true;
      getSome(Event)(ctx, ctx.account.getKey(), false, from, to, options, callback);
    },

    function filterEvents(res, metadata, callback) {
      res = res.filter(function filterFunc(item) {
        return (!type || (item.type === type));
      });

      callback(null, res, metadata);
    }
  ], callback);
};

/**
 * Find dead services and perform the following actions:
 *
 * - insert timeout event for all the dead services
 * - delete dead service and heartbeat marker objects
 *
 * @param {Object} ctx Context object.
 * @param {?Object} options Options object.
 * @param {Function} Callback Callback called with (err).
 **/
exports.rectifyServices = function(ctx, options, callback) {
  var acKey = ctx.account.getKey(),
      hbmsToRemove = [], srvsToRemove = [], shbsToRemove = [],
      work = new instruments.Work('services_rectify'),
      bi = new BatchInsert(ctx, acKey),
      toTs = Date.now() - (options.graceMillis || 0),
      to = highUUIDFromTimestamp(toTs).toString();

  work.start();

  async.waterfall([
    metadata.getOne.bind(null, ctx, acKey),

    function retrieveHeartbeatMarkers(meta, callback) {
      var iterOptions = {'usePaginationParams': false, 'batchSize': 300},
          from = meta.last_rectification,
          fromTs = uuidFromString(from).getTimestamp();

      if (fromTs >= toTs) {
        // Non-fatal race condition, we have already performed rectification for
        // this range. Simply skip it.
        log.debug('Rectification for this range has already been performed. Nothing to do, skipping rectification...',
                  {'from': from, 'to': to});
        callback(new AsyncShortCircuitError());
        return;
      }

      getSome(HeartbeatMarker)(ctx, acKey, false, from, to, iterOptions, function(err, hbms, metadata) {
        callback(err, meta, hbms, metadata);
      });
    },

    function insertServiceTimedOutEvents(meta, hbms, metadata, callback) {
      if (!hbms || hbms.length === 0) {
        // No old markers
        callback(null, meta);
        return;
      }

      hbmsToRemove = hbms;

      async.forEach(hbms, function(hbm, callback) {
        var ts = hbm.getTimestamp();

        async.waterfall([
          function getService(callback) {
            var iterOptions = {'rectify': false}, serviceId;

            // getOne preppends the prefix
            serviceId = hbm.service_id.replace(new RegExp('^' + Service.prefix()), '');
            serviceOps.getOne(ctx, serviceId, iterOptions, callback);
          },

          function insertServiceTimedOutEvent(srv, callback) {
            var eventPayload = {}, eventParams, ev, ts, key;

            srvsToRemove.push(srv);
            shbsToRemove.push(new LastServiceHeartbeat({'_key': srv.getKey()}));

            eventPayload = {
              'id': srv.getKeyWithoutPrefix(),
              'heartbeat_timeout': srv.heartbeat_timeout,
              'tags': srv.tags || [],
              'metadata': srv.metadata || {}
            };

            ts = hbm.getTimestamp();
            key = hbm.getKey();

            // Same marker key is re-used for the event key so the update is atomic.
            eventParams = {'timestamp': ts,
                           'type': 'service.timeout',
                           'payload': eventPayload,
                           '_key': key};
            ev = new Event(eventParams);
            bi.save(ev);
            callback();
          }
        ], callback);
      },

      function() {
        callback(null, meta);
      });
    },

    function updateAccountMetadata(meta, callback) {
      var metaBatch = new BatchInsert(ctx, acKey, {'writeTimestamp': toTs * 1000});
      meta.last_rectification = to.toString();
      metaBatch.save(meta);
      metaBatch.commit(function(err) {
        callback(err);
      });
    },

    function deleteHeartbeatMarkersAndDeadServices(callback) {
      hbmsToRemove.forEach(function(obj) {
        bi.removeObject(obj, 'hard');
      });

      srvsToRemove.forEach(function(obj) {
        bi.removeObject(obj, 'hard');
      });

      shbsToRemove.forEach(function(obj) {
        bi.removeObject(obj, 'hard');
      });

      bi.commit(callback);
    },
  ],

  function(err) {
    if ((err instanceof AsyncShortCircuitError)) {
      err = null;
    }

    work.stop(err);
    callback(err);
  });
};

/**
 * Insert an event.
 *
 * @param {Object} ctx Context object.
 * @param {Object} params Event attributes.
 */
exports.insert = function(ctx, params, callback) {
  var options, bi, ev;

  bi = new BatchInsert(ctx, ctx.account.getKey());
  ev = new Event(params);

  bi.begin();
  bi.save(ev);
  bi.commit(function(err) {
    callback(err, !err ? ev : null);
  });
};
