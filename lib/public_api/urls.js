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

var path = require('path');

var express = require('express');
var middlewareValidator = require('rackspace-shared-middleware/lib/middleware/validator');
var middlewareTiming = require('rackspace-shared-middleware/lib/middleware/timing');
var middlewareAttachVariables = require('rackspace-shared-middleware/lib/middleware/attach_variables');

var middlewareReturnError = require('./middleware/return_error');
var middlewareAccountCreation = require('./middleware/account_creation');
var middlewarePagination = require('./middleware/pagination');
var middlewareDashboardIPValidate = require('../dashboard/middleware/ipvalidation').attachIPValidationMiddleware;
var middlewareHtaccess = require('../dashboard/middleware/auth').wrapHtaccess;
var defs = require('./defs');
var errHandlerFunc = require('../api/utils').errHandlerFunc;

/**
 * Registers the URLs handled by the API 1.0
 * @return {{HTTPServer}} app Express Application.
 */
exports.api_1_0_urls = function() {
  var handlers = require('./handlers'),
      app = express(),
      prefixes, prefix, i;

  prefixes = ['', '/:tenantId'];

  app.use(middlewareTiming.attach());
  app.use(middlewareAttachVariables.attach({'apiVersion': 'v1.0'}));
  app.use(middlewareReturnError.attach());
  app.use(middlewareAccountCreation.attach());

  app.use(middlewareValidator.attach(defs.validity, errHandlerFunc, {'loggerName': 'api.middleware.validator'}));

  for (i = 0; i < prefixes.length; i++) {
    prefix = prefixes[i];

    // Account
    // Note /limits is POST, because it's proxied through rproxy
    app.post(prefix + '/limits', handlers.account.limits);

    // Global
    app.get(prefix + '/events', middlewarePagination.attach({'useMarker': false}), handlers.event.list);

    // Services
    app.get(prefix + '/services', middlewarePagination.attach(), handlers.service.list);
    app.get(prefix + '/services/:serviceId', handlers.service.fetch);
    app.post(prefix + '/services', handlers.service.create);
    app.put(prefix + '/services/:serviceId', handlers.service.update);
    app.del(prefix + '/services/:serviceId', handlers.service.remove);
    app.post(prefix + '/services/:serviceId/heartbeat', handlers.service.heartbeat);

    // Configuration
    app.get(prefix + '/configuration', middlewarePagination.attach(), handlers.configuration.listOrFetch);
    app.get(prefix + '/configuration/*', middlewarePagination.attach(), handlers.configuration.listOrFetch);

    app.put(prefix + '/configuration/*', handlers.configuration.update);
    app.del(prefix + '/configuration/*', handlers.configuration.remove);
  }

  return app;
};


exports._dashboard = function() {
  var app = express();
  app.use('/static/', dashboardStatic());
  app.use('/', dashboard());
  return app;
};

// bypasses the middleware that checks for auth.
function dashboardStatic() {
  var app = express(),
      staticPath = path.join(__dirname, '../dashboard/static');
  app.use('/', express['static'](staticPath));
  return app;
}

function dashboard() {
  var handlers = require('../dashboard/handlers'),
      app = express(),
      dashRoot = path.join(__dirname, '../dashboard');

  app.set('view engine', 'jade');
  app.set('view options', { layout: false });
  app.set('views', path.join(dashRoot, 'views'));
  app.use(middlewareDashboardIPValidate());
  app.use(middlewareHtaccess());

  app.get('/', handlers.index);
  app.get('/accounts', handlers.accounts.list);
  app.get('/accounts/list', handlers.accounts.list);
  app.get('/accounts/lookup', handlers.accounts.lookup);
  app.get('/accounts/lookup/:acctId', handlers.accounts.lookup);
  app.get('/zk', handlers.zk.placeHolder);

  app.get('/data/services/:acctId/:marker/:limit', handlers.data.getServicesPage);
  app.get('/data/configurations/:acctId/:marker/:limit', handlers.data.getConfigurationsPage);

  // cassandra?
  return app;
}
