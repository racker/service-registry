var trace = require('tryfer').trace;

/**
 * @return {Function} middleware.
 */
exports.attach = function attachReturnErrorMiddleware() {
  return function returnError(req, res, next) {
    var headers = req.headers || {}, oldWriteHead = res.writeHead;

    req.tracing = {};
    req.tracing.serverRecvTrace = trace.Trace.fromHeaders('rsr:rproxy:api', headers);

    // Record that we have received a request
    req.tracing.serverRecvTrace.record(trace.Annotation.serverRecv());

    res.writeHead = function() {
      res.writeHead = oldWriteHead;

      // Record that we send response back to the proxy
      req.tracing.serverRecvTrace.record(trace.Annotation.serverSend());
      res.writeHead.apply(this, arguments);
    };

    next();
  };
};
