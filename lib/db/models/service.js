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

var sprintf = require('sprintf').sprintf;
var base = require('cassandra-orm/lib/orm/base');
var utils = require('cassandra-orm/lib/orm/utils');

/**
 * Object representing a Service.
 * @constructor
 * @param {Object} attributes Attributes to set in the resulting object.
 */
var Service = function(attributes) {
  base.DBBase.call(this, Service, attributes);
};

/**
 * Add properties that help map to cassandra
 * complex types
 */
Service.meta = {
  name: 'Service',
  cname: 'service',
  columnFamily: 'services',
  prefix: 'srv',
  dataPrefix: null,
  parents: [],
  indexes: {
    'tags_idx': utils.addIndex(
      {
        key: ['tags'],
        name: ['$ROWKEY', '$OBJKEY'],
        object: 'Service',
        columnFamily: 'tag_to_service_idx' ,
        relationship: 'ScopedOneToMany',
        _getKeys: function(bi, cleaned, meta) {
          var tags = cleaned.cols.tags || [];
          return tags;
        }
      })
  }
};

Service.fields = {
  'heartbeat_timeout': null,
  'metadata': {'default_value': {}},
  'tags': {'default_value': []},
  'last_seen': null
};

Service.operationalVersion = 0;
base.inheritBase(Service, __filename);

Service.prototype.getKeyWithoutPrefix = function() {
  return this.getKey().replace(new RegExp('^' + Service.prefix()), '');
};

Service.prototype.getUrlPath = function() {
  return sprintf('/services/%s', this.getKeyWithoutPrefix());
};

exports.Service = Service;
