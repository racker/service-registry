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

var log = require('logmagic').local('lib.middleware.response.usage');
var uuid = require('node-uuid');
var et = require('elementtree');

var ElementTree = et.ElementTree;
var element = et.Element;
var subElement = et.SubElement;


var sprintf = require('../../util/sprintf').sprintf;
var config = require('../../util/config').config;
var request = require('../../util/request').request;
var misc = require('../../util/misc');

exports.HEADER_KEY_NAMES = ['x-rp-usage-resource-id', 'x-rp-usage-resource-name',
                            'x-rp-usage-resource-action', 'x-rp-usage-resource-timestamp',
                            'x-rp-usage-resource-data'];


/**
 * Send atom entry to the Atom Hopper instance.
 *
 * @param {String} url Atom hopper URL.
 * @param {Object} usageObj Usage object.
 * @param {Function} callback Callback called with (err, res).
 */
function sendEntryToAtomHopper(url, usageObj, callback) {
  var entry = buildAtomEntry(usageObj), options = {'expected_status_codes': [201],
    'headers': {'Content-Type': 'application/atom+xml'}, 'return_response': true, 'timeout': 40000};

  log.debug('Sending entry to Atom Hopper', {'url': url, 'entry': entry});
  request(url, 'POST', entry, options, callback);
}

/**
 * Build an Atom Hopper atom entry.
 *
 * @param {Object} usageObj Usage object.
 * @return {String} Atom hopper entry.
 */
function buildAtomEntry(usageObj) {
  var date, root, tenantId, serviceName, eventType, usageId, dataCenter, region,
      resourceId, category, startTime, endTime, resourceName, etree, xml,
      settings = config.middleware.usage;

  date = new Date(usageObj.timestamp * 1000);

  root = element('entry');
  root.set('xmlns', 'http://www.w3.org/2005/Atom');

  tenantId = subElement(root, 'TenantId');
  tenantId.text = usageObj.user_id;

  serviceName = subElement(root, 'ServiceName');
  serviceName.text = settings.service_name;

  if (usageObj.id) {
    resourceId = subElement(root, 'ResourceID');
    resourceId.text = usageObj.id;
  }

  usageId = subElement(root, 'UsageID');
  usageId.text = uuid.v4();

  eventType = subElement(root, 'EventType');
  eventType.text = usageObj.action;

  category = subElement(root, 'category');
  category.set('term', sprintf('%s.%s.%s', settings.service_name, usageObj.resource, usageObj.action));

  dataCenter = subElement(root, 'DataCenter');
  dataCenter.text = settings.datacenter;

  region = subElement(root, 'Region');
  region.text = settings.region;

  startTime = subElement(root, 'StartTime');
  startTime.text = misc.toRfc3339Date(date);

  resourceName = subElement(root, 'ResourceName');
  resourceName.text = usageObj.resource;

  etree = new ElementTree(root);
  xml = etree.write({'xml_declaration': false});
  return xml;
}

exports.dependencies = [];

if (config.target && config.target.middleware_run_list.response.indexOf('tracing') !== -1) {
  exports.dependencies.push('tracing');
}

exports.processResponse = function(req, res, callback) {
  var settings = config.middleware.usage, id, resource, action, timestamp, data, usageObj,
      headers = res.headers;

  // We call callback immediately, because this middleware performs an async
  // action which doesn't need to block and prevent other middleware from
  // running.
  callback();

  if (headers.hasOwnProperty(exports.HEADER_KEY_NAMES[0])) {
    id = headers[exports.HEADER_KEY_NAMES[0]];
    resource = headers[exports.HEADER_KEY_NAMES[1]];
    action = headers[exports.HEADER_KEY_NAMES[2]];
    timestamp = headers[exports.HEADER_KEY_NAMES[3]];
    data = headers[exports.HEADER_KEY_NAMES[4]];
    usageObj = {'id': id, 'user_id': req.userId, 'resource': resource,
                'action': action, 'timestamp': timestamp, 'data': data};

    try {
      data = JSON.parse(data);
    }
    catch (err) {
      log.error('Failed to parse resource data', {'error': err});
      return;
    }

    sendEntryToAtomHopper(settings.url, usageObj, function(err, res) {
      if (err) {
        log.error('Failed to send entry to Atom Hopper server', {'url': settings.url, 'error': err});
      }
      else {
        log.debug('Entry sucesfully sent to the Atom Hopper server', {'url': settings.url});
      }
    });
  }
};
