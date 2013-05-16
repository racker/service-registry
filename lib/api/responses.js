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

var url = require('url');
var util = require('util');

var swiz = require('swiz');
var sprintf = require('sprintf').sprintf;
var misc = require('rackspace-shared-utils/lib/misc');
var log = require('logmagic').local('farscape.api.responses');

var defs = require('../public_api/defs').defs;
var fault = require('./fault');
var paginationUtils = require('../util/pagination');
var errors = require('../util/errors');
var context = require('../db/context');

var settings = require('../util/settings');

/**
 * Convert an instance of an Error to a fault object.
 * @param {?Object} err Potential Error object.
 * @return {Object} Fault object based on the potential error.
 */
function convertErrorToFault(err) {
  var parser, details;

  if (err instanceof fault.Fault) {
    return err;
  }
  else if (err instanceof errors.ObjectDoesNotExistError) {
    return new fault.notFoundError('object does not exist', err.message);
  }
  else if (err instanceof errors.ValidationError) {
    if (/service with id .*? already exists/i.test(err.message)) {
      return new fault.serviceWithThisIdExists(err.message, err.message);
    }

    return new fault.badRequest(err.message, err.message);
  }
  else if (err instanceof errors.ValveValidationError) {
    return new fault.badRequest(err.message, err.details);
  }
  else if (err instanceof errors.LimitReachedError) {
    return new fault.limitReached('Resource limit has been reached', err.message);
  }

  if (settings.ERROR_STACK_TRACES) {
    return new fault.internalError(err.message, err.stack);
  }
  else {
    return new fault.internalError(err.message, err.message);
  }
}

/**
 * superclass; not to be invoked directly.
 *
 * @constructor
 * @param {Number} code the HTTP code.
 * @param {?String} payload the response payload.
 * @param {?Object} headers the headers.
 */
function Response(code, payload, headers) {
  this.code = code;

  if (typeof this.code === 'string') {
    this.code = parseInt(this.code, 10);
  }

  this.payload = payload;
  this.headers = headers || {};
  /* This is used to send a Location header, but only once we know the correct http host */
  this._relativeLocation = null;
}

/** write the status code, headers, and payload
 * @param {Object} req The Request.
 * @param {Object} res The Response.
 */
Response.prototype.perform = function(req, res) {
  var tenantUrl;

  if (this._relativeLocation !== null) {
    tenantUrl = this._getApiUrl(req) + '/' + req.apiVersion;
    // If this request is returning a location header but does not have an
    // account attached (currently only true on the admin API), we assume that
    // the Location should not include a tenant id.
    if (req.account) {
      tenantUrl += '/' + req.account.getKey().replace('ac', '');
    }

    this.headers.Location = tenantUrl + this._relativeLocation;
  }


  // Add content-length if it's not present
  if (this.payload && !this.headers.hasOwnProperty('content-length')) {
    this.headers['content-length'] = Buffer.byteLength(this.payload, 'utf8');
  }

  if (this.code === 200 || this.code === 204 || this.code === 201) {
    log.debug('Response', {
      ctx: context.createFromRequest(log, req),
      code: this.code,
      location: this.headers.location,
      headers: this.headers,
      payload: this.payload
    });
  }
  else {
    log.debug('Response', {
      ctx: context.createFromRequest(log, req),
      code: this.code,
      headers: this.headers,
      payload: this.payload
    });
  }

  res.on('error', function(err) {
    log.error('Error while sending response: ' + err.toString(), {'err': err});
  });

  res.writeHead(this.code, this.headers);

  if (this.payload) {
    res.write(this.payload);
  }

  res.end();
};

/**
 * Parse API server URL from the request. Rules for this:
 * 1. If x-forwarded-port or x-forwarded-proto are specified, they are used.
 * 2. If a port is in the host header, it is used as a fallback.
 * 3. Use details from the local connection as a fallback.
 * 4. If the port matches the protocol, it is stripped.
 * @param {Object} req Request object.
 * @return {String} API server URL.
 */
Response.prototype._getApiUrl = function(req) {
  var host = req.headers.host,
      port = req.headers['x-forwarded-port'],
      proto = req.headers['x-forwarded-proto'],
      splitIndex = host.lastIndexOf(':'),
      address;

  // If the Host header includes a port, split it out, and use it if we don't
  // already have one
  if (splitIndex !== -1) {
    port = port || host.slice(splitIndex + 1);
    host = host.slice(0, splitIndex);
  }

  // This conditional exists only to prevent unnecessary calls to
  // connection.address(), host and port are individually filled in if they are
  // missing.
  if (!host || !port) {
    address = req.connection.address();
    host = host || address.address.toString();
    port = port || address.port.toString();
  }

  // If the protocol still is unknown, check the local connection
  proto = proto || req.connection.encrypted ? 'https' : 'http';

  // The port is only included in the Location if it is non-standard for the
  // protocol
  if ((port === '80' && proto === 'http') || (port === '443' && proto === 'https')) {
    port = '';
  }
  else {
    // Note: ele way doesn't work with Cloud LoadBalancer which doesn't set
    // x-forwarder-port
    // port = ':' + port;
    port = '';
  }

  return proto + '://' + host + port;
};

/**
 * Determine a serialization format for the provided request and set the
 * response Content-Type header accordingly.
 *
 * @param {Object} req Request object.
 * @return {Number} Serialization format.
 */
Response.prototype._getSerializationFormat = function(req) {
  var format = swiz.SERIALIZATION.SERIALIZATION_JSON;

  if (format === swiz.SERIALIZATION.SERIALIZATION_JSON) {
    this.headers['Content-Type'] = 'application/json; charset=UTF-8';
  }

  return format;
};

/** Base Response class. */
exports.Response = Response;

/**
 * Response which includes usage headers.
 *
 * @constructor
 * @param {String} type Usage response type (one of: create, update, delete).
 * @param {Object} obj Database object.
 * @param {Number} code the HTTP code.
 * @param {?String} payload the response payload.
 * @param {?Object} headers the headers.
 */
function ResponseWithUsageHeaders(type, obj, code, payload, headers) {
  headers = headers || {};

  headers['x-rp-usage-resource-id'] = obj.getKey();
  headers['x-rp-usage-resource-name'] = obj._type.meta.name.toLowerCase();
  headers['x-rp-usage-resource-action'] = type;
  headers['x-rp-usage-resource-timestamp'] = misc.getUnixTimestamp();
  headers['x-rp-usage-resource-data'] = JSON.stringify(obj.toDb());

  Response.call(this, code, payload, headers);
}

util.inherits(ResponseWithUsageHeaders, Response);

/**
 * Respond to an OPTIONS request with Allowed Access control headers,
 * to enable cross domain Javascript requests.
 *
 * @constructor
 */
function AccessControlResponse() {
  var headers = this._addHeaders({});
  Response.call(this, 204, null, headers);
}

util.inherits(AccessControlResponse, Response);

AccessControlResponse.prototype._addHeaders = function(headers) {
  headers['Access-Control-Allow-Origin'] = '*';
  headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE, OPTIONS';
  headers['Access-Control-Max-Age'] = '86400';
  headers['Access-Control-Allow-Headers'] = 'X-Auth-Token, Content-Type, Accept';
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Expose-Headers'] = 'X-Response-Id, WWW-Authenticate';
};

exports.AccessControlResponse = AccessControlResponse;

/**
 * Write 201 and Location Header
 *
 * @constructor
 * @param {Object} obj Actual object.
 * @param {?Object} payload Response payload.
 */
function CreateResponse(obj, payload) {
  ResponseWithUsageHeaders.call(this, 'create', obj, 201, payload, {});
  this._relativeLocation = obj.getUrlPath();
  log.debug('CreateResponse', {relativeLocation: this._relativeLocation});
}

util.inherits(CreateResponse, ResponseWithUsageHeaders);

/**
 * Write HTTP Status 201 and Location Header
 */
exports.CreateResponse = CreateResponse;

/**
 * Write a 204 without a Location header.
 *
 * @constructor
 * @param {Object} obj object to use as the source of the delete.
 */
function DeleteResponse(obj) {
  ResponseWithUsageHeaders.call(this, 'delete', obj, 204, null, {});
}
util.inherits(DeleteResponse, ResponseWithUsageHeaders);

/**
 * Write HTTP Status 204 without a Location header.
 */
exports.DeleteResponse = DeleteResponse;

/**
 * Error Response (4xx/5xx HTTP Status)
 *
 * @constructor
 *
 * @param {?Error} error the error object.
 * @param {Object} headers Optional headers sent with the response.
 */
function ErrorResponse(error, headers) {
  headers = headers || {};
  var fault = convertErrorToFault(error);

  if (fault.code && typeof fault.code === 'string') {
    fault.code = parseInt(fault.code, 10);
  }

  Response.call(this, fault.code || 400);

  this.type = fault.element || 'badRequest';
  this.error = error;
  this.fault = fault;

  this.obj = {
    'type': this.type,
    'message' : fault.message,
    'details' : fault.details,
    'code' : fault.code,
    'txnId': 'unknown'
  };

  this.privateMessage = this.obj.message;
  this.privateDetails = this.obj.details;

  this.headers = misc.merge(this.headers, headers);

  if (this._is5xx()) {
    // hide 5xx error data.
    this.privateMessage = this.obj.message;
    this.privateDetails = this.obj.details;
    this.obj.message = 'Internal Error';
    this.obj.details = 'Internal Error';
  }

  this.obj.getSerializerType = function() {
    return 'fault';
  };
}
util.inherits(ErrorResponse, Response);

/** Retrieve the exception object.
 * @return {Object} Error object.
 */
ErrorResponse.prototype.getError = function() {
  return this.error;
};

/** write the status code, headers, and payload
 * @param {Object} req Node request object.
 * @param {Object} res Node response object.
 */
ErrorResponse.prototype.perform = function(req, res) {
  if (this.error) {
    var sw = new swiz.Swiz(defs, {stripNulls: false}),
        sz = swiz.SERIALIZATION.SERIALIZATION_JSON,
        self = this;

    // since the txnId could not be set during construction, set it now.
    self.obj.txnId = req.txnId;
    sz = this._getSerializationFormat(req);
    sw.serialize(sz, 1, this.obj, function(err, results) {
      if (err) {
        // So what do you do when things get so messed up that you can't serialize the error message?  Ehrm.  Punt?
        if (sz === swiz.SERIALIZATION.SERIALIZATION_XML) {
          self.payload = '<fault><type>internalError<code>500</code><message></message><details></details></fault>';
        } else {
          self.payload = JSON.stringify({'type': 'internalError', 'code': 500});
        }
        log.error('Problem serializing ErrorResponse.obj ', misc.merge(self.obj, {'ctx': req.ctx}));
      } else {
        self.payload = results;
      }

      if (self._is5xx()) {
        log.error('Internal Error', {ctx: req.ctx,
                                            message: self.privateMessage,
                                            details: self.privateDetails,
                                            txnId: req.txnId});
      }

      Response.prototype.perform.call(self, req, res);
    });
  }
};

/** @return {boolean} whether or not this ErrorResponse is a 5xx error. */
ErrorResponse.prototype._is5xx = function() {
  return this.fault && this.fault.code >= 500 && this.fault.code <= 599;
};

/** Standard error response
 *
 */
exports.ErrorResponse = ErrorResponse;

/**
 * Unauthorized Response (401 HTTP Status)
 *
 * @constructor
 *
 * @param {string} msg response message.
 */
function UnauthorizedResponse(msg) {
  ErrorResponse.call(this, new Error(msg));
}
util.inherits(UnauthorizedResponse, ErrorResponse);

/**
 * Unauthorized Response (401 HTTP Status)
 */
exports.UnauthorizedResponse = UnauthorizedResponse;

/**
 * Forbidden Response (403 HTTP Status)
 *
 * @constructor
 *
 * @param {string} msg response message.
 */
function ForbiddenResponse(msg) {
  ErrorResponse.call(this, new Error(msg));
}
util.inherits(ForbiddenResponse, ErrorResponse);

/**
 * Unauthorized Response (403 HTTP Status)
 */
exports.ForbiddenResponse = ForbiddenResponse;

/**
 * Update Response.
 * Write a 204 without a Location header.
 * @constructor
 * @param {Object} obj object to use as the source of the update.
 */
function UpdateResponse(obj) {
  ResponseWithUsageHeaders.call(this, 'update', obj, 204, null, {});
  this._relativeLocation = obj.getUrlPath();
  log.debug('UpdateResponse', {relativeLocation: this._relativeLocation});
}

util.inherits(UpdateResponse, ResponseWithUsageHeaders);

/** Update response **/
exports.UpdateResponse = UpdateResponse;

/**
 * @constructor
 * @param {Object} obj Swiz Object.
 * @param {Number} code The response code is optional.
 * @param {String} type Response type (public|private).
 * @param {Object} options Options object.
 */
function SwizResponse(obj, code, options) {
  options = options || {};
  Response.call(this, code || 200, options.headers || {});

  this._obj = obj;
  this._type = options.type || 'public';
  this._options = options;
}
util.inherits(SwizResponse, Response);

/** write the status code, headers, and payload
 * @param {Object} req Node request object.
 * @param {Object} res Node response object.
 */
SwizResponse.prototype.perform = function(req, res) {
  var sw = new swiz.Swiz(defs, {'for': this._type, 'stripNulls': false}),
      sz = swiz.SERIALIZATION.SERIALIZATION_JSON,
      re,
      obj,
      self = this;

  if (this._options.stripKeyPrefix) {
    obj = this._stripKeyPrefix(this._obj);
  }
  else {
    obj = this._obj;
  }

  sz = this._getSerializationFormat(req);
  sw.serialize(sz, 1, obj, function(err, results) {
    if (err) {
      re = new ErrorResponse(err);
      re.perform(req, res);
      return;
    }

    self.payload = results;
    Response.prototype.perform.call(self, req, res);
  });
};


/**
 * Strip key prefix from the object key.
 *
 * @type {Object|Array} obj Object to strip the key prefix from.
 * @return {Object|Array} Object without a key prefix.
 */
SwizResponse.prototype._stripKeyPrefix = function(obj) {
  var i, item, isArray = (obj instanceof Array), regex;

  if (!isArray) {
    obj = [obj];
  }

  for (i = 0; i < obj.length; i++) {
    item = obj[i];
    regex = new RegExp('^' + item._type.prefix());
    item.key = item.key.replace(regex, '');
  }

  if (!isArray) {
    return obj[0];
  }

  return obj;
};


/**
* Serializes the object pointed to by data, into XML or JSON,
* depending on the request headers. Using the object_name we look
* up a consistent mapping of the Object -> XML/JSON layout.
*/
exports.SwizResponse = SwizResponse;

/**
 * @constructor
 * @param {Object} obj Swiz Object.
 * @param {Number} code The response code is optional.
 * @param {Object} data Data object with 'hasMore' and 'nextKey'
 * attributes.
 * @param {Object} options Options object.
 */
function SwizListResponse(obj, code, data, options) {
  SwizResponse.call(this, obj, code, options);
  this._data = data || {};
}

util.inherits(SwizListResponse, SwizResponse);

/** Write the status code, headers, and payload
 * @param {Object} req Node request object.
 * @param {Object} res Node response object.
 */
SwizListResponse.prototype.perform = function(req, res) {
  var self = this,
      sw = new swiz.Swiz(defs, {'for': this._type, 'stripNulls': false}),
      sz = swiz.SERIALIZATION.SERIALIZATION_JSON,
      parsed,
      re,
      obj,
      resourceUrl, metadata, nextMarker;

  parsed = url.parse(req.url);
  nextMarker = this._data.nextKey;

  sz = this._getSerializationFormat(req);

  if (this._options.stripKeyPrefix) {
    obj = this._stripKeyPrefix(this._obj);
  }
  else {
    obj = this._obj;
  }

  if (nextMarker && (['Service', 'ConfigurationValue'].indexOf(obj[0]._type.meta.name) !== -1)) {
    // TODO: Better way of stripping a prefix
    nextMarker = this._data.nextKey.replace(new RegExp('^' + obj[0]._type.meta.prefix), '');
  }

  resourceUrl = sprintf('%s/%s%s', this._getApiUrl(req), req.apiVersion, parsed.pathname);
  metadata = paginationUtils.getMetaDataObj(this._obj.length, req, nextMarker, resourceUrl);

  sw.serializeForPagination(sz, this._obj, metadata, function(err, results) {
    if (err) {
      re = new ErrorResponse(err);
      re.perform(req, res);
      return;
    }

    self.payload = results;
    Response.prototype.perform.call(self, req, res);
  });
};

exports.SwizListResponse = SwizListResponse;
