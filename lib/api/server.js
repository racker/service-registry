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

var http = require('http');
var express = require('express');

var log = require('logmagic').local('api.server');

var settings = require('../util/settings');
var responses = require('./responses');
var fault = require('./fault');

function APIServer(type, options) {
  this._type = type;
  this._options = options;

  this._app = express();
  this._server = http.createServer(this._app);
}

APIServer.prototype._notFoundHandler = function(req, res) {
  log.warning('404', {'request': req, 'url': req.url, 'method': req.method});
  var resp = new responses.ErrorResponse(new fault.notFoundError('The page cannot be found.',
                                                                 {'requested_path': req.originalUrl}));
  resp.perform(req, res);
};

APIServer.prototype._initialize = function(callback) {
  if (settings.DEBUG) {
    process.on('uncaughtException', function(err) {
      console.error(err);
      console.error(err.stack);
    });
  }

  callback();
};

APIServer.prototype._listen = function(host, port, callback) {
  var self = this;

  this._server.listen(port, host, function(err) {
    if (err) {
      callback(err);
      return;
    }

    log.infof('${type} API server listening on ${host}:${port}', {'type': self._type,
                                                                  'host': host, 'port': port});
    callback();
  });
};

exports.APIServer = APIServer;
