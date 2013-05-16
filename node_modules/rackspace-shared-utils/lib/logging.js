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

// TODO: Remove it once PR is merged into node-logmagic
var graylogSink = require('logmagic/lib/graylog.js');

/**
 * Build a logmagic sink which sends messages in graylog format to UDP port.
 *
 * @param {Object} client UDP client.
 * @param {String} host Destination host.
 * @param {String} port Destination port.
 * @return {Function} Sink function.
 */
exports.getUdpLoggingSink = function(client, host, port) {
  return function loggingSink(module, level, message, obj) {
    obj = obj || {};
    var ge, address, consumer, key, value, jsonStr, messageBuffer;

    jsonStr = graylogSink.logstr(module, level, message, obj);

    messageBuffer = new Buffer(jsonStr);

    try {
      client.send(messageBuffer, 0, messageBuffer.length, port, host);
    }
    catch (err) {}
  };
};


