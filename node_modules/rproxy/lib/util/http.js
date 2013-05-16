exports.returnResponse = function returnResponse(res, code, body, headers) {
  headers = headers || {};
  body = body || '';

  if (!headers.hasOwnProperty('content-length')) {
    headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
  }

  headers.Connection = 'close';

  res.writeHead(code, headers);
  res.end(body);
};


exports.returnJson = function returnJson(res, code, obj, headers) {
  headers = headers || {};
  headers['Content-Type'] = 'application/json';
  exports.returnResponse(res, code, JSON.stringify(obj), headers);
};


exports.returnError = function returnError(res, code, msg, headers) {
  var obj;
  code = code || 900;
  msg = msg || '';

  obj = {
    'message': msg
  };

  exports.returnJson(res, code, obj, headers);
};
