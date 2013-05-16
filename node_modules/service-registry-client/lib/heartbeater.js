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

var util = require('util');

var log = require('logmagic').local('service-registry-client.heartbeater');
var sprintf = require('sprintf').sprintf;
var misc = require('rackspace-shared-utils/lib/misc');
var request = require('rackspace-shared-utils/lib/request');
var errors = require('rackspace-shared-utils/lib/errors');

var BaseClient = require('./base').BaseClient;

// interval will be this many seconds less than specified to account for latency at different layers.
var INTERVAL_PROACTIVE_SECONDS = 3;

function HeartBeater(username, apiKey, region, options, serviceId, initialToken, timeout) {
  this._serviceId = serviceId;
  this._heartbeatTimeout = timeout;

  if (this._heartbeatTimeout < 15) {
    this._heartbeatInterval = (this._heartbeatTimeout * 0.6);
  }
  else {
    this._heartbeatInterval = (this._heartbeatTimeout * 0.8);
  }

  this._timeoutId = null;
  this._nextToken = initialToken;

  this._stopped = false;

  HeartBeater.super_.call(this, username, apiKey, region, options);
}

util.inherits(HeartBeater, BaseClient);

HeartBeater.prototype._startHeartbeating = function() {
  // TODO: persistent connection doesn't work with 0.8
  var url = sprintf('/services/%(serviceId)s/heartbeat',
      {'serviceId': this._serviceId}),
      payload = {'token': this._nextToken},
      reqOptions = {'expectedStatusCode': 200},
      self = this, interval;

  if (this._options.persistentConnections) {
    reqOptions.persistent = true;
  }

  if (this._stopped) {
    return;
  }

  // TODO: Use a persistent connection
  log.debug('Sending heartbeat', {'serviceId': this._serviceId, 'token': this._nextToken});

  this._request(url, 'POST', payload, reqOptions, function(err, res) {
    if (err) {
      log.error('API endpoint returned an error', {'error': err});

      if (!((err instanceof errors.UnexpectedStatusCodeError) && err.statusCode === 404)) {
        // Non 404, immediately re-try heartbeat
        interval = 10;
        self._timeoutId = setTimeout(self._startHeartbeating.bind(self), interval);
        return;
      }

      // We cannot communicate with the server. Chances are this service is going to die.
      // So no sense in re-trying.
      self.emit('error', err);
      return;
    }

    interval = self._heartbeatInterval;

    // Jitter for the heartbeat interval
    if (interval > 5) {
      interval = interval + misc.getRandomInt(-3, 1) - INTERVAL_PROACTIVE_SECONDS;
    }

    if (interval <= 0) {
      // ugh. put it back and take your chances.
      interval = interval + INTERVAL_PROACTIVE_SECONDS;
    }

    interval = interval * 1000;

    log.debugf('Scheduling next interval for ${interval}s in future',
              {'serviceId': self._serviceId, 'interval': parseInt(interval / 1000, 10)});

    self._nextToken = res.body.token;
    self._timeoutId = setTimeout(self._startHeartbeating.bind(self), interval);
  });
};

HeartBeater.prototype.start = function() {
  log.debug('Starting heartbeating', {'serviceId': this._serviceId});
  this._startHeartbeating();
};

HeartBeater.prototype.stop = function() {
  log.debug('Stopping heartbeating', {'serviceId': this._serviceId});

  this._stopped = true;
  if (this._timeoutId) {
    clearTimeout(this._timeoutId);
    this._timeoutId = null;
  }
};

exports.HeartBeater = HeartBeater;
