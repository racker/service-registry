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

var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var misc = require('rackspace-shared-utils/lib/misc');

var PAGINATION_MARKER_QUERY_STRING = require('../public_api/middleware/pagination').PAGINATION_MARKER_QUERY_STRING;
var PAGINATION_LIMIT_QUERY_STRING = require('../public_api/middleware/pagination').PAGINATION_LIMIT_QUERY_STRING;


/**
 * Return pagination meta data object.
 *
 * @param {Number} count Number of objects in the response.
 * @param {Object} req Request object.
 * @param {String} nextMarker Next key which can be used as a marker in the subsequent request.
 * @param {String} reqUrl Request URL.
 * @return {Object} Bound object with pagination meta data.
 */
exports.getMetaDataObj = function(count, req, nextMarker, reqUrl) {
  var metadata = {
    'count': (count || 0),
    'limit': (req.ctx.pagination.limit || null),
    'marker': (req.ctx.pagination.marker || null),
    'next_marker': nextMarker || null,
    'next_href': null
  };

  if (nextMarker) {
    metadata.next_href = exports.getNextPageUrl(reqUrl, nextMarker, req);
  }

  return metadata;
};


/**
 * Get a URL to the next page.
 *
 * @param {String} reqUrl Request URL.
 * @param {String} nextMarker Next key which can be used as a marker in the subsequent request.
 * @param {Object} req The original request.
 * @return {String} URL to the next page.
 */
exports.getNextPageUrl = function(reqUrl, nextMarker, req) {
  var obj = {}, qs, url;

  obj[PAGINATION_MARKER_QUERY_STRING] = nextMarker;

  if (req.query) {
    obj = misc.merge(req.query, obj);
  }

  qs = querystring.stringify(obj);
  url = sprintf('%s?%s', reqUrl, qs);
  return url;
};
