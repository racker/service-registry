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

var cassandra = require('cassandra-client');
var logmagic = require('logmagic');
var log = logmagic.local('lib.db.backends.cassandra');

var misc = require('../../util/misc');

var DEFAULT_READ_CONSISTENCY = 'ONE';
var DEFAULT_WRITE_CONSISTENCY = 'ONE';


/**
 * Cassandra client.
 * @constructor
 *
 * @param {Object} options Client options.
 */
var CassandraClient = function(options) {
  options = options || {};

  this._options = options;

  this._hosts = options.hosts;
  this._keyspace = options.keyspace;
  this._timeout = options.timeout;
  this._columnFamily = options.column_family;
  this._readConsistency = options.read_consistency || DEFAULT_READ_CONSISTENCY;
  this._writeConsistency = options.write_consistency || DEFAULT_WRITE_CONSISTENCY;

  this._rowKey = 'rproxy';

  this._client = this._getClient();
  this._client.connect(function(err) {
    if (err) {
      log.error('Failed to connect to cassandra', {'err': err});
      process.exit(1);
    }

    log.debug('Sucesfully connected to cassandra');
  });
};


/**
 * Set up and return a cassandra client instance.
 *
 * @return {Object} Cassandra client instance.
 */
CassandraClient.prototype._getClient = function() {
  var options, client;

  options = {
      'hosts': this._hosts,
      'keyspace': this._keyspace,
      'use_bigints': false,
      'cql_version': '2.0.0'
  };

  if (this._timeout) {
    options.timeout = this._timeout;
  }

  client = new cassandra.PooledConnection(options);
  client.on('log', function(level, message, obj) {
    if (level === 'cql') {
      level = 'trace';
    }

    if (['error', 'info', 'debug', 'trace'].indexOf(level) === -1) {
      level = 'debug';
    }

    obj = obj || {};
    log[level](message, obj);
  });

  return client;
};


/**
 * Execute a query and format the result.
 *
 * @param {String} query CQL query.
 * @param {Array} args Values used for binding the query.
 * @param {Function} callback Callback called with (err, res).
 */
CassandraClient.prototype._execute = function(query, args, callback) {
  this._client.execute(query, args, function(err, res, metadata) {
    if (err) {
      callback(err);
      return;
    }

    if (!res) {
      callback(null, null);
      return;
    }

    res = res[0].cols.map(function(col) {
      return col.value;
    });

    callback(null, res);
  });
};


/**
 * Retrieve multiple values.
 *
 * @param {String} columnFamily Column family.
 * @param {String} key Key.
 * @param {Function} callback Callback called with (err, results).
 */
CassandraClient.prototype._getMulti = function(columnFamily, keys, callback) {
  var query, args, tmp;

  tmp = misc.buildPlaceholderString(keys.length);

  query = 'SELECT ' + tmp + ' FROM ? USING CONSISTENCY ' + this._readConsistency + ' WHERE KEY = ?';
  args = keys.concat([columnFamily, this._rowKey]);
  this._execute(query, args, callback);
};


/**
 * Retrieve a value.
 *
 * @param {String} key Key.
 * @param {Function} callback Callback called with (err, result).
 */
CassandraClient.prototype.get = function(key, callback) {
  this.getMulti([key], function(err, res) {
    if (err) {
      callback(err);
      return;
    }

    if (res && res.length === 0) {
      res = null;
    }

    callback(null, res);
  });
};


/**
 * Retrieve multiple values.
 *
 * @param {String} key Key.
 * @param {Function} callback Callback called with (err, results).
 */
CassandraClient.prototype.getMulti = function(keys, callback) {
  this._getMulti('main', keys, callback);
};


/**
 * Retrieve multiple counters.
 *
 * @param {String} key Key.
 * @param {Function} callback Callback called with (err, results).
 */
CassandraClient.prototype.getCounters = function(keys, callback) {
  this._getMulti('counters', keys, callback);
};


/**
 * Set a key.
 *
 * @param {String} key Key.
 * @param {String} value Value.
 * @param {?Object} Options with the following keys: ttl.
 * @param {Function} callback Callback called with (err, result).
 */
CassandraClient.prototype.set = function(key, value, options, callback) {
  options = options || {};
  var query, ttlStr = ' ', args;

  if (options.ttl) {
    ttlStr = ' AND TTL ' + options.ttl;
  }

  query = 'UPDATE ? USING CONSISTENCY ' + this._writeConsistency;
  query += ttlStr + ' SET ? = ? WHERE KEY = ?';
  args = ['main', key, value, this._rowKey];
  this._execute(query, args, callback);
};


/**
 * Set multiple values.
 *
 * @param {Object} values Object with key / value pairs.
 * @param {?Object} Options with the following keys: ttl.
 * @param {Function} callback Callback called with (err, result).
 */
CassandraClient.prototype.setMulti = function(values, options, callback) {
  options = options || {};
  var query, ttlStr = ' ', args, valueArgs = [], keys = Object.keys(values), key, value, i;

  if (options.ttl) {
    ttlStr = ' AND TTL ' + options.ttl;
  }

  query = 'UPDATE ? USING CONSISTENCY ' + this._writeConsistency;
  query += ttlStr + ' SET ';

  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    value = values[key];

    query += '? = ?';
    valueArgs.push(key);
    valueArgs.push(value);

    if (i !== (keys.length - 1)) {
      query += ', ';
    }
  }

  query += ' WHERE KEY = ?';

  args = ['main'].concat(valueArgs).concat([this._rowKey]);
  this._execute(query, args, callback);
};


/**
 * Increment a counter.
 *
 * @param {String} key Key.
 * @param {?Object} Options with the following keys: ttl, step.
 * @param {Function} callback Callback called with (err, result).
 */
CassandraClient.prototype.incr = function(key, options, callback) {
  options = options || {};
  var query, ttlStr = ' ', args, step = step || 1;

  if (options.ttl) {
    ttlStr = ' AND TTL ' + options.ttl;
  }

  query = 'UPDATE ? USING CONSISTENCY ' + this._writeConsistency;
  query += ttlStr + ' SET ? = ? + ? WHERE KEY = ?';
  args = ['counters', key, key, step, this._rowKey];
  this._execute(query, args, callback);
};


/*
 * Remove a key.
 *
 * @param {String} key Key.
 * @param {Function} callback Callback called with (err, result).
 */
CassandraClient.prototype.remove = function remove(key, callback) {
  var query, args;

  query = 'DELETE ? FROM ? USING CONSISTENCY ' + this._writeConsistency;
  query += ' WHERE KEY = ?';
  args = [key, 'main', this._rowKey];

  this._execute(query, args, callback);
};


exports.CassandraClient = CassandraClient;
