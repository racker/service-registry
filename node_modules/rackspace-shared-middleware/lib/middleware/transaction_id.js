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

var os = require('os');

var express = require('express');

var randstr = require('rackspace-shared-utils/lib/misc').randstr;

var txnPrefix = '.rh-' + randstr(4) + '.h-' + os.hostname();
var txnCount = 0;


function generateTxnId(version) {
  var t = new Date().getTime(),
      i = txnCount;

  txnCount += 1;
  return txnPrefix + '.r-' + randstr(8) + '.c-' + i + '.ts-' + t.toString() + '.v-' + version;
}


/**
 *
 * @param {Options} Options object with the following keys: version
 * @return {Function} attaches request transaction Id property to a request and response.
 */
exports.attach = function attachTransactionIdMiddleware(options) {
  return function addTxnId(req, res, next) {
    var version = options.version, txnId = generateTxnId(version), writeHead = res.writeHead;

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


/** generateTxnId function. **/
exports.generateTxnId = generateTxnId;
