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

/**
 * Create a Operation context to act as a baton for db operations,
 * enable better logging and easier parameter passing.
 *
 * @constructor
 * @param {dbu.Account} account Account used for this context.
 * @param {String} txnId Transaction ID for this context.
 * @param {?Object} pagination Pagination parameters.
 */
function DbOperationContext(account, txnId, pagination) {
  var self = this, service, labels, label, i, len, name;

  this.account = account;
  this.txnId = txnId;
  this.pagination = pagination || {};
  this.updatedObjects = [];
  this.tracing = null;
}

/**
 * Account setter on a context.
 * @param {db.Account} account Account used for this context.
 */
DbOperationContext.prototype.setAccount = function(account) {
  this.account = account;
};

/**
 * Attach a Valve validator to the context for later use in an update.
 * @param {swiz.Valve} valve The Valve instance to attach.
 */
DbOperationContext.prototype.setValve = function(valve) {
  this.valve = valve;
};

/**
 * capture an object so that it can be made part of an audit.
 * @param {DBBase} obj db object to capture.
 */
DbOperationContext.prototype.captureObject = function(obj) {
  this.updatedObjects.push(obj);
};

/**
 * Set pagination object.
 *
 * @param {Object} pagination Pagination object.
 */
DbOperationContext.prototype.setPagination = function(pagination) {
  this.pagination = pagination;
};

/**
 * Create a context object for all db operations.
 *
 * @param {LogMagic} log Log magic context for this context.
 * @param {dbu.Account} account Account used for this context.
 * @param {String} txnId Transaction ID for this context.
 * @param {?Object} pagination Pagination parameters.
 * @return {DbOperationContext} Context for these db operations.
 */
exports.create = function(account, txnId, pagination) {
  var ctx = new DbOperationContext(account, txnId, pagination);
  return ctx;
};

/**
 * Create a context object for all db operations, based on a request object.
 *
 * @param {LogMagic} log Log magic context for this context.
 * @param {HTTPRequest} req Related http request for this context.
 * @return {DbOperationContext} Context for these db operations.
 */
exports.createFromRequest = function(req) {
  var args = [req.account, req.txnId];

  if (req.pagination) {
    args.push(req.pagination);
  }

  return exports.create.apply(null, args);
};

exports.DbOperationContext = DbOperationContext;
