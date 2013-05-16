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

/**
 * En example which uses EventsFeedPoller abstraction to poll the events feed
 * and print all of the events to the standard output.
 */
var Client = require('../lib').Client;
var EventsFeedPoller = require('../lib').EventsFeedPoller;

var EVENT_KEYS = [
  'service.join',
  'service.timeout',
  'service.remove',
  'configuration_value.update',
  'configuration_value.remove'
];

var client = new Client('myusername', 'myapikey', 'us');
var eventsPoller = new EventsFeedPoller(client.events, {'pollInterval': 5});

function printEmittedEvent(type) {
  return function(payload) {
    console.log('Event type: ' + type);
    console.log('Event payload: ' + JSON.stringify(payload));
  };
}

// Add listener for all the available events
EVENT_KEYS.forEach(function(key) {
  eventsPoller.on(key, printEmittedEvent(key));
});

eventsPoller.on('error', function(err) {
  console.log('Error occured: ' + err.toString());
});

// Start polling
eventsPoller.start();
