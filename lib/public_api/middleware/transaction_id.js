/*
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

var logmagic = require('logmagic');
var express = require('express');
var middlewareTransactionId = require('rackspace-shared-middleware/lib/middleware/transaction_id');

/**
 * @param {Object} options with the following keys: loggerName, logLevel,
* version
 * @return {Function} attaches request transaction Id property to a request and response.
 */
exports.attach = function attachTransactionIdMiddleware(options) {
  options = options || {};

  var loggerName = options.loggerName || 'transaction_id',
      logLevel = options.logLevel || 'debug',
      logger = logmagic.local(loggerName);

  return function addTxnId(req, res, next) {
    var txnId = req.headers['x-rp-request-id'], writeHead = res.writeHead;

    if (!txnId) {
      // If transaction id is not provided by the backend, generate one.
      logger[logLevel]('Transaction ID is not located in the request headers,' +
                       ' generating one...');
      txnId = middlewareTransactionId.generateTxnId(options.version);
    }

    res.writeHead = function(code, headers) {
      res.writeHead = writeHead;

      if (!headers) {
        headers = {};
      }

      headers['X-Response-Id'] = txnId;
      res.writeHead(code, headers);
    };

    req.txnId = txnId;
    res.txnId = txnId;

    // register txnId with express logger
    express.logger.token('txnId', function(req, res) { return txnId; });
    next();
  };
};
