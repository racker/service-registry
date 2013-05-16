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

/**
 * A middleware which responds to any OPTIONS requests with a 204 and an Access control Response.
 *
 * See: http://www.w3.org/TR/cors/
 * See: https://developer.mozilla.org/En/HTTP_access_control
 *
 * @return {Function} the middleware.
 */
exports.attach = function attachAccessControlMiddleware() {
  return function accessControlMiddleware(req, res, next) {
    var headers = {};

    if (req.method === 'OPTIONS') {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE, OPTIONS';
      headers['Access-Control-Max-Age'] = '86400';
      headers['Access-Control-Allow-Headers'] = 'X-Auth-Token, Content-Type, Accept';
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Expose-Headers'] = 'X-Response-Id, WWW-Authenticate';

      res.writeHead(204, headers);
      res.end();
      return;
    }

    next();
  };
};
