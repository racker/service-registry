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

var fs = require('fs');
var path = require('path');

var async = require('async');

/**
 * Get files in a directory which match the provided name pattern.
 * Note: This function recurses into sub-directories.
 *
 * @param {String} directory Directory to search.
 * @param {String} matchPattern File name match pattern.
 * @param {Object} options Optional options object.
 * @param {Function} callback Callback called with (err, matchingFilePaths).
 */
exports.getMatchingFiles = function getMatchingFiles(directory, matchPattern, options, callback) {
  options = options || {};
  var matchedFiles = [],
      recurse = options.recurse || false;

  fs.readdir(directory, function(err, files) {
    if (err) {
      callback(null, matchedFiles);
      return;
    }

    async.forEach(files, function(file, callback) {
      var filePath = path.join(directory, file);
      fs.stat(filePath, function(err, stats) {
        if (err) {
          callback();
        }
        else if (stats.isDirectory() && recurse) {
          getMatchingFiles(filePath, matchPattern, options, callback);
        }
        else if (matchPattern.test(file)) {
          matchedFiles.push(filePath);
          callback();
        }
        else {
          callback();
        }
      });
    },

    function(err) {
      callback(err, matchedFiles);
    });
  });
};
