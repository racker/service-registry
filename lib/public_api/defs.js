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

var swiz = require('swiz');
var o = swiz.struct.Obj;
var f = swiz.struct.Field;
var Chain = swiz.Chain;

/**
 * The serialization definitions
 * @type {Array}
 */
exports.defs = [
  o('account',
    {
      'fields': [
        f('id', {'src' : 'key', 'ignorePublic': true, 'attribute': true}),
        f('limits', {'val': new Chain().isHash(new Chain().isString(), new Chain().isInt().toInt()).optional()}),
        f('metadata', {'desc': 'Arbitrary key/value pairs.',
                         'val' : new Chain().numItems(0, 20).isHash(new Chain().isString().len(1, 255),
                                                                    new Chain().isString().len(1, 255)).optional()})
      ],

      'singular': 'account',
      'plural': 'accounts'
  }),

  o('service',
    {
      'fields': [
        f('id', {'src' : 'key', 'attribute': true, 'desc': 'Service id',
                 'val': new Chain().isString().len(3, 65).regex('^[a-z0-9_\\-\\.]{3,65}$', 'i').immutable()}),
        f('tags', {'desc': 'Service tags.',
                 'val': new Chain().numItems(0, 10).isArray(new Chain().isString().len(1, 55)).optional()}),
        f('metadata', {'desc': 'Arbitrary key/value pairs.',
                 'val' : new Chain().numItems(0, 20).isHash(new Chain().isString().len(1, 255),
                                                            new Chain().isString().len(1, 255)).optional()}),
        f('heartbeat_timeout', {'desc': 'Maximum time between heartbeats', 'val': new Chain().isInt().range(3, 120).toInt()}),
        f('last_seen', {'ignorePublic': true, 'desc': 'Timestamp when this service was last seen'})
      ],

      'singular': 'service',
      'plural': 'services'
  }),

  o('event',
    {
      'fields': [
        f('id', {'src' : 'key', 'attribute': true, 'desc': 'Event id',
                 'val': new Chain().isString().len(3, 255).immutable()}),
        f('timestamp', {'desc': 'Event timestamp', 'val': new Chain().isInt()}),
        f('type', {'desc': 'Event type', 'val': new Chain().isString()}),
        f('payload', {'desc': 'Event payload.',
                         'val' : new Chain().optional().isHash(new Chain().isString().len(1, 255),
                                                               new Chain().isString().len(1, 255)).optional()})
      ],

      'singular': 'event',
      'plural': 'events'
  }),

  o('configuration_value',
    {
      // NOTE: if you update the validation for id, make sure you do the same for configuration_value_qs.
      'fields': [
        f('id', {'src' : 'key', 'attribute': true, 'desc': 'Configuration value id',
                 'val': new Chain().isString().len(3, 500).regex('^(\\\/[a-z0-9_\\-]{3,50}\\\/?){0,10}([a-z0-9_\\-\\.]{3,170})?$', 'i').immutable().optional()}),
        f('value', {'desc': 'Configuration value', 'val': new Chain().isString().len(1, 1024)})
      ],

      'singular': 'configuration_value',
      'plural': 'configuration_values'
  }),

  o('heartbeat',
    {
      'fields': [
        f('token', {'desc': 'Heartbeat token.', 'val' : new Chain().isString().isV1UUID()})
      ],

      'singular': 'heartbeat',
      'plural': 'heartbeats'
  }),

  o('fault', {
    fields: [
      f('type', {src: 'type'}),
      f('code', {src: 'code'}),
      f('message', {src: 'message'}),
      f('details', {src: 'details'}),
      f('txnId', {src: 'txnId'})
    ],

    singular: 'fault',
    plural: 'faults'
  }),

  /* Validators for query string parameters */

  o('configuration_value_qs',
    {
      'fields': [
        f('id', {'src' : 'key', 'attribute': true, 'desc': 'Configuration value id',
                 'val': new Chain().isString().len(3, 500).regex('^(\\\/[a-z0-9_\\-]{3,50}\\\/?){0,10}([a-z0-9_\\-\\.]{3,170})?$', 'i').immutable()}),
      ],

      'singular': 'configuration_value',
      'plural': 'configuration_values'
  })
];

exports.validity = swiz.defToValve(exports.defs);
