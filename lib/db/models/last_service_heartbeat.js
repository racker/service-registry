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

var base = require('cassandra-orm/lib/orm/base');
var uuidFromBuffer = require('rackspace-shared-utils/lib/uuid').uuidFromBuffer;

/**
 * Object representing a LastServiceHeartbeat.
 * @constructor
 * @param {Object} attributes Attributes to set in the resulting object.
 */
var LastServiceHeartbeat = function(attributes) {
  base.DBBase.call(this, LastServiceHeartbeat, attributes);
};

/**
 * Add properties that help map to cassandra
 * complex types
 */
LastServiceHeartbeat.meta = {
  name: 'LastServiceHeartbeat',
  cname: 'last_service_heartbeat',
  columnFamily: 'last_service_heartbeats',
  prefixedColNames: false,
  lookupByName: true,
  parents: [],
  ttl: 7 * 24 * 60 * 60, // 7 days
};

LastServiceHeartbeat.fields = {
  'timestamp': null
};

LastServiceHeartbeat.operationalVersion = 0;
base.inheritBase(LastServiceHeartbeat, __filename);

exports.LastServiceHeartbeat = LastServiceHeartbeat;
