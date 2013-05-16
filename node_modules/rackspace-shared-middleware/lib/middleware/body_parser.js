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

var Swiz = require('swiz').Swiz;
var logmagic = require('logmagic');

function parseXML(defs, body) {
  var sw = new Swiz(defs, {stripNulls: false});
  return sw.deserializeXml(body);
}

function parseJSON(defs, body) {
  return JSON.parse(body);
}

/**
 * Returns a body parsing middleware that can parse all supported body types.
 * @param {Object} defs Swiz definitions.
 * @param {Function} errHandler A function which is called with (req, res) and
 * must return a function which gets called with (err) if the invalid content
 * type is provided.
 * @param {Object} options with the following keys: supportedContentTypes, loggerName, defaultContentType.
 * @return {Function} The middlware.
 */
exports.attach = function attachBodyParserMiddleware(defs, errHandler, options) {
  var loggerName = options.loggerName || 'middleware.body_parser',
      log = logmagic.local(loggerName);

  return function bodyParser(req, res, next) {
    var defaultContentType = options.defaultContentType || 'application/json',
        supportedContentTypes = options.supportedContentTypes,
        errHandlerFunc;

    errHandlerFunc = errHandler(req, res);

    req.contentType = (req.headers['content-type'] || defaultContentType).toLowerCase().split(';')[0];
    if (supportedContentTypes.indexOf(req.contentType) === -1) {
      errHandlerFunc(new Error('Unsupported content type: ' + req.contentType));
      return;
    }

    try {
      req.body = (req.body !== '') ? exports.PARSERS[req.contentType](defs, req.body) : {};
    } catch (e) {
      log.info('error parsing request body', {err: e, body: req.body, ct: req.contentType});
      errHandlerFunc(new Error('Failed to parse request body: ' + e.message));
      return;
    }

    next();
  };
};

exports.PARSERS = {
  'application/xml': parseXML,
  'application/json': parseJSON
};
