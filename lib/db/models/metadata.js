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
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;
var uuidFromBuffer = require('rackspace-shared-utils/lib/uuid').uuidFromBuffer;

/**
 * Every account has metadata.
 * @constructor
 * @param {Object} attributes Attributes to set in the resulting object.
 */
var Metadata = function(attributes) {
  base.DBBase.call(this, Metadata, attributes);
};

/**
 * Add properties that help map to cassandra
 * complex types
 */
Metadata.meta = {
  name: 'Metadata',
  cname: 'metadata',
  columnFamily: 'metadata',
  lookupByName: true,
  prefixedColNames: false,
  parents: [],
  colNameConverter: function(buf) { return [uuidFromBuffer(buf).toString()]; }
};

/**
 * Fields on the Account
 */
Metadata.fields = {
  'last_rectification': { 'default_value': lowUUIDFromTimestamp(0).toString() }
};

Metadata.operationalVersion = 0;
base.inheritBase(Metadata, __filename);

exports.Metadata = Metadata;
