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

var async = require('async');
var logmagic = require('logmagic');
var log = require('logmagic').local('service-registry-client.client');
var sprintf = require('sprintf').sprintf;

var misc = require('rackspace-shared-utils/lib/misc');
var request = require('rackspace-shared-utils/lib/request');
var errors = require('rackspace-shared-utils/lib/errors');

var BaseClient = require('./base').BaseClient;
var HeartBeater = require('./heartbeater').HeartBeater;
var EventsFeedPoller = require('./events_feed_poller').EventsFeedPoller;
var utils = require('./utils');

/**
 * Maximum heartbeat timeout in seconds.
 */
var MAX_HEARTBEAT_TIMEOUT = 30 * 1000;

/* Events */

function EventsClient() {
  BaseClient.apply(this, arguments);

  this._poller = new EventsFeedPoller(this, {});
}

util.inherits(EventsClient, BaseClient);

EventsClient.prototype.list = function(marker, options, callback) {
  var url;
  options = (misc.merge(options, {}) || {});

  if (marker !== null && marker !== undefined) {
    options.queryString = misc.merge((options.queryString || {}), {});
    options.queryString.marker = marker;
  }

  url = sprintf('/events');
  this._list(url, options, callback);
};

/**
 * Return singleton EventsFeedPoller instance.
 */
EventsClient.prototype.getPoller = function() {
  return this._poller;
};

/* Services */

function ServicesClient() {
  BaseClient.apply(this, arguments);
}

util.inherits(ServicesClient, BaseClient);

ServicesClient.prototype.list = function(options, callback) {
  var url = sprintf('/services');
  this._list(url, options, callback);
};

ServicesClient.prototype.listForTag = function(tag, options, callback) {
  options = (misc.merge(options, {}) || {});
  options.queryString = misc.merge((options.queryString || {}), {});
  options.queryString.tag = tag;

  var url = '/services';
  this._list(url, options, callback);
};

ServicesClient.prototype.get = function(serviceId, callback) {
  var url = sprintf('/services/%(serviceId)s', {'serviceId': serviceId});
  this._get(url, {}, callback);
};

ServicesClient.prototype.create = function(serviceId, heartbeatTimeout, payload, callback) {
  payload = misc.merge(payload || {}, {});
  payload.id = serviceId;
  payload.heartbeat_timeout = heartbeatTimeout;
  var url = '/services', self = this, response;

  this._create(url, payload, {}, function(err, res) {
    var initialToken, hb;

    if (err) {
      callback(err);
      return;
    }

    response = self._options.raw ? res : res.body;
    initialToken = res.body.token;

    hb = new HeartBeater(self._username, self._apiKey, self._region,
                         self._options, serviceId, initialToken, heartbeatTimeout);

    hb.on('error', function(err) {
      log.error('Unrecoverable error in heartbeat.', {'err': err});
      hb.stop();
    });

    callback(null, response, hb);
  });
};

ServicesClient.prototype.register = function(serviceId, heartbeatTimeout, payload, options, callback) {
  options = options || {};
  var retryDelay = options.retryDelay || 2000,
      retryCount = options.retryCount || (MAX_HEARTBEAT_TIMEOUT / retryDelay),
      retryCounter = 0, success = false, res = null, lastErr = null,
      self = this, hb = null;

  async.whilst(
    function testFunction() {
      retryCounter++;
      return (retryCounter < retryCount && !success);
    },

    function createService(callback) {
      self.create(serviceId, heartbeatTimeout, payload, function(err, _res, _hb) {
        lastErr = err;

        if (err && err.response && err.response.body && err.response.body.type &&
            err.response.body.type === 'serviceWithThisIdExists') {
          log.info('Service which this ID already exists, assuming this service has died, retrying...');
          err = null;
        }
        else if (!err) {
          success = true;
          res = _res;
          hb = _hb;
        }

        setTimeout(callback.bind(null, err), retryDelay);
      });
    },

    function(err) {
      callback((err || lastErr), res, hb);
    }
  );
};

ServicesClient.prototype.heartbeat = function(serviceId, token, callback) {
  var url = sprintf('/services/%(serviceId)s/heartbeat', {'serviceId': serviceId}),
      payload = {'token': token}, self = this, response;
  this._request(url, 'POST', payload, {'expectedStatusCode': 200}, function(err, res) {
    if (err) {
      callback(err);
      return;
    }

    response = self._options.raw ? res : res.body.token;
    callback(null, response);
  });
};

ServicesClient.prototype.update = function(serviceId, payload, callback) {
  var url = sprintf('/services/%(serviceId)s', {'serviceId': serviceId}),
      self = this, response;

  this._update(url, payload, {}, function(err, res) {
    var serviceId;

    if (err) {
      callback(err);
      return;
    }
    serviceId = self._getIdFromUrl(res.headers.location);
    response = self._options.raw ? res : serviceId;
    callback(null, response);
  });
};

ServicesClient.prototype.remove = function(serviceId, callback) {
  var url = sprintf('/services/%(serviceId)s', {'serviceId': serviceId});
  this._remove(url, {}, callback);
};

/* Configuration */

function ConfigurationClient() {
  BaseClient.apply(this, arguments);
}

util.inherits(ConfigurationClient, BaseClient);

ConfigurationClient.prototype.list = function(options, callback) {
  var url = '/configuration';
  this._list(url, options, callback);
};

ConfigurationClient.prototype.listForNamespace = function(namespace, options, callback) {
  var url = '/configuration', tmp = namespace;

  // Make sure leading and trailing slashes are present
  if (namespace.charAt(0) !== '/') {
    tmp = '/' + tmp;
  }

  if (namespace.charAt(namespace.length - 1) !== '/') {
    tmp += '/';
  }

  url += tmp;

  this._list(url, options, callback);
};

ConfigurationClient.prototype.get = function(configurationId, callback) {
  var url = sprintf('/configuration/%(configurationId)s', {'configurationId': configurationId}),
      self = this, response;
  this._get(url, {}, function(err, data) {
    if (err) {
      callback(err);
      return;
    }

    response = self._options.raw ? data : data.value;
    callback(null, response);
  });
};

ConfigurationClient.prototype.set = function(configurationId, value, callback) {
  var payload = {'value': value}, self = this, response, url;
  url = sprintf('/configuration/%(configurationId)s', {'configurationId': configurationId});
  this._update(url, payload, {}, function(err, res) {
    if (self._options.raw) {
      callback(err, res);
    }
    else {
      callback(err);
    }
  });
};

ConfigurationClient.prototype.remove = function(configurationId, callback) {
  var url = sprintf('/configuration/%(configurationId)s', {'configurationId': configurationId});
  this._remove(url, {}, callback);
};

/* Account */

function AccountClient() {
  BaseClient.apply(this, arguments);
}

util.inherits(AccountClient, BaseClient);

AccountClient.prototype.getLimits = function(callback) {
  var url = sprintf('/limits');
  this._get(url, {}, callback);
};

function Client(username, apiKey, region, options) {
  options = options || {};
  var authUrl = utils.getAuthUrl(options, region), keystoneClientOptions;

  if (!options.keystoneClient) {
    keystoneClientOptions = {'username': username, 'apiKey': apiKey,
                             'cacheTokenFor': 600};
    options.keystoneClient = utils.getKeystoneClient(authUrl,
                                                     keystoneClientOptions,
                                                     log);
  }

  this.services = new ServicesClient(username, apiKey, region, options);
  this.events = new EventsClient(username, apiKey, region, options);
  this.configuration = new ConfigurationClient(username, apiKey, region, options);
  this.account = new AccountClient(username, apiKey, region, options);
}

exports.Client = Client;
