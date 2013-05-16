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
 * Express middleware that limits the size of a request body.
 *
 * @param {Object} options Object with the following keys: maxSize, loggerName.
 * @return {Function} The middleware instance.
 */
exports.attach = function attachBodySizeLimiter(options) {
  var loggerName = options.loggerName || 'middleware.body_accepter',
      log = logmagic.local(loggerName);

  return function bodySizeLimiter(req, res, next) {
    var maxSize = options.maxSize, cl, bodyLen = 0, oversize = false;

    cl = req.headers['content-length'];

    if (cl) {
      cl = parseInt(cl, 10);

      if (cl >= maxSize) {
        log.msg('Denying client for too large content length', {content_length: cl, max: maxSize});
        res.writeHead(413, {Connection: 'close'});
        res.end();

        if (req.transport) {
          req.transport.close();
        }

        return;
      }
    }

    req.body = '';
    req.setEncoding('utf8');

    req.on('data', function(chunk) {
      req.body += chunk;
      bodyLen += chunk.length;

      if (bodyLen >= maxSize) {
        log.msg('Denying client for body too large', {content_length: bodyLen, max: maxSize});
        res.writeHead(413, {Connection: 'close'});
        res.end();

        if (req.transport) {
          req.transport.close();
        }

        oversize = true;
      }
    });

    req.on('end', function() {
      if (!oversize) {
        next();
      }
    });
  };
};
