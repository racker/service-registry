/*
 *  Copyright 2011 Rackspace
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

var logmagic = require('logmagic');

/**
 * Uses logmagic to output GELF log format
 *
 * @param {Object} options with the following keys: loggerName, logLevel
 *
 * @return {Function} The middleware.
 */
exports.attach = function attachLogger(options) {
  options = options || {};

  var loggerName = options.loggerName || 'access_log',
      logLevel = options.logLevel || 'info',
      logOnIncoming = (options.logOnIncoming) ? options.logOnIncoming : false,
      accessLog = logmagic.local(loggerName);

  return function logger(req, res, next) {
    var obj = {};

    req._startTime = new Date();

    obj['start-time'] = req._startTime;
    obj['original-url'] = req.originalUrl;

    if (req.txnId) {
      obj.txnId = req.txnId;
    }

    if (logOnIncoming) {
      accessLog[logLevel]('Incoming request: ' + req.originalUrl, obj);
    }

    // mount safety
    if (req._logging) {
      next();
      return;
    }

    // flag as logging
    req._logging = true;

    // proxy end to output loggging
    var end = res.end;
    res.end = function(chunk, encoding) {
      var obj = {};

      // Make sure the end function actually executes
      res.end = end;
      res.end(chunk, encoding);

      // Build our logging information
      obj['start-time'] = req._startTime;
      obj['response-time'] = new Date() - req._startTime;
      obj['remote-addr'] = req.socket &&
          (req.socket.remoteAddress ||
          (req.socket.socket && req.socket.socket.remoteAddress));
      obj.method = req.method;
      obj['http-version'] = req.httpVersionMajor + '.' + req.httpVersionMinor;
      obj.status = res.statusCode;
      obj['content-length'] = res._headers['content-length'];
      obj.payload = JSON.stringify(req.body);
      obj.referrer = req.headers.referer;
      obj['user-agent'] = req.headers['user-agent'];
      obj['x-forwarded-for'] = req.headers['x-forwarded-for'];
      obj.txnId = req.txnId;

      if (req.account) {
        obj.accountId = req.account.getKey();
      }
      else {
        /* unauthenticated user */
        obj.accountId = null;
      }

      // Log using logmagic our access info
      accessLog[logLevel](req.originalUrl, obj);
    };

    next();
  };
};
