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
 * Faults.
 */
var faultTable = {
  universalFaults: {},
  faultDescription: {},
  faults: {}
};



/**
 * Superclass; not to be invoked directly.
 *
 * @constructor
 * @param {Number} code the HTTP response code.
 * @param {String} element the response element.
 * @param {String} message the response message.
 * @param {String|Object} details the response details.
 */
function Fault(code, element, message, details) {
  this.code = code;
  this.element = element;
  this.message = message;
  this.details = details;
  this.getSerializerType = function() {
    return 'fault';
  };
}


/** Define a fault
 * @param {Number} code the HTTP response code.
 * @param {String} element the response element.
 */
function defineFault(code, element) {
  var CreateFault = function(code, element, message, details) {
    return new Fault(code, element, message, details);
  };
  exports[element] = CreateFault.bind(null, code, element);
}


/** Define a fault
 * @param {String} tag the tag (e.g. 'Entities') for the fault.
 * @param {String} subtag the subtag (e.g. 'Create') for the fault.
 * @param {Number} code the HTTP response code.
 * @param {String} element the response element.
 */
function annotateFaultCase(tag, subtag, code, element) {
  if (!faultTable.faults.hasOwnProperty(tag)) {
    faultTable.faults[tag] = {};
  }
  if (!faultTable.faults[tag].hasOwnProperty(subtag)) {
    faultTable.faults[tag][subtag] = {};
  }
  faultTable.faults[tag][subtag][element] = code;
}


/** Annotate a fault as 'universal' and define it
 * @param {Number} code the HTTP response code.
 * @param {String} element the response element.
 * @param {String} longdesc the longer description.
 */
function annotateUniversalFault(code, element, longdesc) {
  faultTable.universalFaults[element] = code;
  faultTable.faultDescription[element] = longdesc;
  defineFault(code, element);
}

annotateUniversalFault('400', 'badRequest',
    'The system received an invalid value in a request');
annotateUniversalFault('400', 'serviceWithThisIdExists',
    'Service with the specified if already exists');
annotateUniversalFault('400', 'invalidLimit',
    'Invalid limit has been specified.');

annotateUniversalFault('400', 'badRequestHttpsOnly',
    'API endpoint is only accessible over a secure (https) connection');
annotateUniversalFault('400', 'limitReached',
    'Limit has been reached. Please contact sr@rackspace.com to increase your limit.');

annotateUniversalFault('400', 'rateLimitReached',
    'Rate limit has been reached. Please wait before trying again.');

annotateUniversalFault('401', 'unauthorizedError',
    'The system received a request from a user that is not authenticated.');
annotateUniversalFault('403', 'forbiddenError',
    'The system received a request that the user is forbidden to make.');

annotateUniversalFault('404', 'notFoundError',
    'The URL requested is not found in the system.');

annotateUniversalFault('413', 'requestTooLargeError',
    'The response body is too large.');

annotateUniversalFault('500', 'internalError',
    'The system suffered an internal failure.');

annotateUniversalFault('501', 'notImplementedError',
    'The request is for a feature that has not yet been implemented.');

annotateUniversalFault('503', 'systemFailureError',
    'The system is experiencing heavy load or another system failure.');


exports.Fault = Fault;
exports.DefineFault = defineFault;
exports.AnnotateFaultCase = annotateFaultCase;
exports.AnnotateUniversalFault = annotateUniversalFault;
exports.faultTable = faultTable;
