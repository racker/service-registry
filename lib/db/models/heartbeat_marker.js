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
var uuidFromString = require('rackspace-shared-utils/lib/uuid').uuidFromString;

/**
 * Object representing a HeartbeatMarker.
 * @constructor
 * @param {Object} attributes Attributes to set in the resulting object.
 */
var HeartbeatMarker = function(attributes) {
  base.DBBase.call(this, HeartbeatMarker, attributes);
};

/**
 * Add properties that help map to cassandra
 * complex types
 */
HeartbeatMarker.meta = {
  name: 'HeartbeatMarker',
  cname: 'heartbeat_marker',
  columnFamily: 'heartbeat_markers',
  prefixedColNames: false,
  lookupByName: true,
  parents: [],
  colNameConverter: function(buf) { return [uuidFromBuffer(buf).toString()]; }
};

HeartbeatMarker.fields = {
  'service_id': null
};

HeartbeatMarker.operationalVersion = 0;
base.inheritBase(HeartbeatMarker, __filename);

HeartbeatMarker.prototype.getTimestamp = function() {
  var ts = uuidFromString(this.getKey()).getTimestamp();
  return ts;
};

exports.HeartbeatMarker = HeartbeatMarker;
