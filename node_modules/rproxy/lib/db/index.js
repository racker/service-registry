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

var config = require('../util/config').config;
var backends = require('./backends');

var CLIENT = null;

exports.getClient = function getClient() {
  var backend = config.database.backend, settings = config.database.settings;

  if (!CLIENT) {
    if (backend === 'redis') {
      CLIENT = new backends.redis(settings);
    }
    else if (backend === 'cassandra') {
      CLIENT = new backends.cassandra(settings);
    }
    else {
      throw new Error('Unsupported backend: ' + backend);
    }
  }

  return CLIENT;
};
