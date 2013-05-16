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

var sprintf = require('sprintf').sprintf;

/**
 * Very simple object merging.
 * Merges two or more objects together, returning the first object containing a
 * superset of all attributes.  There is a hiearchy of precedence starting with
 * left side and moving right.
 *
 * @return {Object} The merged object.
 */
exports.fullMerge = function() {
  var args = Array.prototype.slice.call(arguments),
      first,
      a,
      attrname,
      i, l;

  if (args.length < 2) {
    throw new Error('Incorrect use of the API, use at least two operands');
  }

  first = args[0];

  for (i = 1, l = args.length; i < l; i++) {
    a = args[i];
    for (attrname in a) {
      if (a.hasOwnProperty(attrname)) {
        first[attrname] = a[attrname];
      }
    }
  }
  return first;
};


/**
 * Very simple object merging.
 * Merges two objects together, returning a new object containing a
 * superset of all attributes.  Attributes in b are prefered if both
 * objects have identical keys.
 *
 * @param {Object} a Object to merge.
 * @param {Object} b Object to merge, wins on conflict.
 * @return {Object} The merged object.
 */
exports.merge = function(a, b) {
  return exports.fullMerge({}, a, b);
};


/**
 * Convert a date string to unix timestamp.
 *
 * @param {String} dateStr Date and time string.
 * @return {Number} Number of seconds since unix epoch.
 */
exports.dateStrToUnixTimestamp = function(dateStr) {
  return Math.round((Date.parse(dateStr) / 1000));
};


/**
 * Return unix timestamp
 *
 * @param  {Date} date Date object to convert to Unix timestamp. If no date is
                       provided, current time is used.
 * @return {Number} Number of seconds passed from Unix epoch.
 */
exports.getUnixTimestamp = function(date) {
  var dateToFormat = date || new Date();

  return Math.round(dateToFormat / 1000);
};


/**
 * Return RFC3339 date string.
 *
 * @param {Date} date Date object.
 * @return {String} RFC339 formatted date string.
 */
exports.toRfc3339Date = function(date) {
  var str, values;

  function addZero(num) {
    if (num < 10) {
      return '0' + num;
    }

    return num;
  }

  values = {
    'year': date.getUTCFullYear(),
    'month': addZero(date.getUTCMonth() + 1),
    'day': addZero(date.getUTCDate()),
    'hours': addZero(date.getUTCHours()),
    'minutes': addZero(date.getUTCMinutes()),
    'seconds': addZero(date.getUTCSeconds())
  };

  return sprintf('%(year)s-%(month)s-%(day)sT%(hours)s:%(minutes)s:%(seconds)sZ', values);
};


/**
 * Build a string of ? placeholders which can be used in Cassandra queries.
 *
 * @param {Number} len Number of placeholders to insert.
 * @return {String} Placeholder string.
 */
exports.buildPlaceholderString = function(len) {
  var i, str = '';

  for (i = 0; i < len; i++) {
    str += '?';

    if (i !== (len - 1)) {
      str += ',';
    }
  }

  return str;
};


/**
 * Replace placeholders in a string with a values array.
 *
 * @param {Array} values Values used for replacing placeholders.
 * @param {String} string String with the placeholders.
 * @param {Number} startIndex Start index.
 */
exports.replacePlaceholders = function(values, string, startIndex) {
  var len, i;

  startIndex = startIndex || 0;

  for (i = startIndex, len = values.length; i < len; i++) {
    string = string.replace('${' + i + '}', values[i]);
  }

  return string;
};
