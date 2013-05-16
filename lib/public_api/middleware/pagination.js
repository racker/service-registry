var sprintf = require('sprintf').sprintf;
var log = require('logmagic').local('farscape.api.middleware.pagination');

var settings = require('../../util/settings');
var responses = require('../../api/responses');
var fault = require('../../api/fault');
var ValveQueryStringValidationError = require('../../util/errors').ValveQueryStringValidationError;


/**
 * Regular expression for valid characters in the pagination offset marker.
 * @type {RegExp}
 * @const
 */
// TODO: Allow user to specify different marker validation regular expressions
// for a different API endpoint
var MARKER_RE = new RegExp(/^[a-z0-9\-:_\.\/]{0,255}$/i);


/**
 * Regular expression for valid characters in the limit query string parameter.
 * @type {RegExp}
 * @const
 */
var LIMIT_RE = new RegExp(/^\d+$/i);


/**
 * Query string key for the limit pagination value.
 * @type {String}
 */
var PAGINATION_LIMIT_QUERY_STRING = 'limit';


/**
 * Query string key for the marker pagination value.
 * @type {String}
 */
var PAGINATION_MARKER_QUERY_STRING = 'marker';


exports.attach = function attachPaginationMiddleware(options) {
  options = options || {};

  if (!options.hasOwnProperty('useMarker')) {
    options.useMarker = true;
  }

  /**
   * Attach pagination parameters to the request object.
   *
   * @param {Object} req Request object.
   * @param {Object} res Response object.
   * @param {Function} next Callback called with (err).
   */
  return function paginationMiddleware(req, res, next) {
    var query = req.query, resp, limit, marker, paginationObj, err;

    limit = query[PAGINATION_LIMIT_QUERY_STRING];

    if ((limit !== undefined && limit !== null) && !LIMIT_RE.test(limit)) {
      resp = new responses.ErrorResponse(new fault.invalidLimit('Invalid limit',
                                                                'Limit must be a number'));
      resp.perform(req, res);
      return;
    }

    limit = parseInt((query[PAGINATION_LIMIT_QUERY_STRING] || settings.PAGINATION_DEFAULT_LIMIT), 10);
    marker = query[PAGINATION_MARKER_QUERY_STRING];

    if (isNaN(limit) || limit < 1 || limit > settings.PAGINATION_MAX_LIMIT) {
      resp = new responses.ErrorResponse(new fault.invalidLimit('Invalid limit',
                                                                sprintf('Invalid limit %s. Minimum limit is %s ' +
                                                                        'and maximum limit is %s.',
                                                                        limit, 1, settings.PAGINATION_MAX_LIMIT)));
      resp.perform(req, res);
      return;
    }

    if (options.useMarker && marker && !MARKER_RE.test(marker)) {
      err = new ValveQueryStringValidationError('marker', new Error(sprintf('Marker contains invalid ' +
                                                           'characters. Valid characters ' +
                                                           'are: %s', MARKER_RE.toString())));
      resp = new responses.ErrorResponse(err);
      resp.perform(req, res);
      return;
    }

    paginationObj = {'limit': limit};

    if (options.useMarker) {
      paginationObj.marker = marker;
    }

    req.ctx.setPagination(paginationObj);
    next();
 };
};


exports.PAGINATION_LIMIT_QUERY_STRING = PAGINATION_LIMIT_QUERY_STRING;
exports.PAGINATION_MARKER_QUERY_STRING = PAGINATION_MARKER_QUERY_STRING;
