var log = require('logmagic').local('farscape.api.middleware.return_error');

var fault = require('../../api/fault');
var responses = require('../../api/responses');


/**
 * @return {Function} middleware.
 */
exports.attach = function attachReturnErrorMiddleware() {
  return function returnError(req, res, next) {
    var errorCode = req.headers['x-rp-error-code'], errorMessage = req.headers['x-rp-error-message'],
        resp, headers;

    if (!errorCode || !errorMessage) {
      // No error, return early and process with the request.
      next();
      return;
    }

    if (['NR-1000', 'NR-1001', 'NR-1002'].indexOf(errorCode) !== -1) {
      headers = {'www-authenticate': req.headers['x-rp-www-authenticate']};
      resp = new responses.ErrorResponse(new fault.unauthorizedError('forbidden', errorMessage), headers);
    }
    else if (errorCode === 'NR-2000') {
      resp = new responses.ErrorResponse(new fault.rateLimitReached('Rate limit has been reached.', errorMessage));
    }
    else {
      log.error('Rproxy passed unrecognized error code, returning a generic internal error to the user', {
        'code': errorCode, 'message': errorMessage});
      resp = new responses.ErrorResponse(new fault.internalError('Unknown error', errorMessage));
    }

    resp.perform(req, res);
  };
};
