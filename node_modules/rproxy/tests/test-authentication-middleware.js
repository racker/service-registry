var async = require('async');

var request = require('util/request').request;
var testUtil = require('util/test');

exports.test_missing_tenant_id = function(test, assert) {
  var server = null;

  async.waterfall([
    function getTestHttpServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
    },

    function issueRequest(callback) {
      var options = {'return_response': true};
      request('http://127.0.0.1:9000', 'GET', null, options, function(err, res) {
        assert.ok(err);
        assert.ok(res.headers.hasOwnProperty('x-rp-www-authenticate'));
        assert.equal(err.statusCode, 400);
        assert.match(res.body, /No tenant id provided/i);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};

exports.test_missing_auth_token = function(test, assert) {
  var server = null;

  async.waterfall([
    function getTestHttpServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
    },

    function issueRequest(callback) {
      var options = {'return_response': true};

      options.headers = {'X-Tenant-Id': '1234'};
      request('http://127.0.0.1:9000', 'GET', null, options, function(err, res) {
        assert.ok(err);
        assert.equal(err.statusCode, 400);
        assert.match(res.body, /No authentication token provided/i);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};

exports.test_missing_credentials_whitelisted_url = function(test, assert) {
  var server = null;

  async.waterfall([
    function getTestHttpServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
    },

    function issueRequest(callback) {
      var options = {'return_response': true};
      request('http://127.0.0.1:9000/whitelisted', 'GET', null, options, function(err, res) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};

exports.test_invalid_auth_token = function(test, assert) {
  var server = null;

  async.waterfall([
    function getTestHttpServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
    },

    function issueRequest(callback) {
      var options = {'return_response': true};

      options.headers = {'X-Tenant-Id': '1234', 'X-Auth-Token': 'invalid'};
      request('http://127.0.0.1:9000', 'GET', null, options, function(err, res) {
        assert.ok(err);
        assert.ok(res.headers.hasOwnProperty('x-rp-www-authenticate'));
        assert.equal(err.statusCode, 401);
        assert.match(res.body, /invalid or expired authentication token/i);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};

exports.test_fake_auth_regex = function(test, assert) {
  var server = null;
  async.waterfall([
    
    function getServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;
        server.get('*', function(req, res) {
          res.writeHead(200, {
            'X-request-was-honored': 'woot'
          });
          res.end();
        });
        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
      
    },
    
    function goodRequest(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};
      options.headers = {'X-Tenant-Id': 'FAKEGARY', 'X-Auth-Token': 'FAKETOKEN'};
      request('http://127.0.0.1:9000/', 'GET', null, options, function(err, res) {
        assert.ok(!err);
        callback();
      });
    },
    
    function badRequest(callback) {
      var options = {'return_response': true};
      options.headers = {'X-Tenant-Id': 'XXXXGARY', 'X-Auth-Token': 'XXXXTOKEN'};
      request('http://127.0.0.1:9000/', 'GET', null, options, function(err, res) {
        assert.ok(err);
        assert.strictEqual(res.statusCode, 200); // Why not 404? Auth failed!
        callback();
      });
    }
  ],
    
  function(err) {
    if (server) {
      server.close();
    }
    assert.ifError(err);
    test.finish();
  });
};

exports.test_valid_auth_token = function(test, assert) {
  var server = null, reqCount = 0;

  async.waterfall([
    function getTestHttpServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        server.get('*', function(req, res) {
          assert.ok(!req.headers.hasOwnProperty('x-rp-error-code'));

          reqCount++;
          res.writeHead(200, {});
          res.end();
        });

        testUtil.setupErrorEchoHandlers(server);
        callback();
      });
    },

    function issueRequestTenantIdInHeader(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};

      options.headers = {'X-Tenant-Id': '7777', 'X-Auth-Token': 'dev'};
      request('http://127.0.0.1:9000', 'GET', null, options, function(err, res) {
        assert.ok(!err);
        assert.equal(res.statusCode, 200);
        callback();
      });
    },

    function issueRequestTenantIdInUrl(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};

      options.headers = {'X-Auth-Token': 'dev'};
      request('http://127.0.0.1:9000/7777/bar', 'GET', null, options, function(err, res) {
        assert.ok(!err);
        assert.equal(res.statusCode, 200);
        callback();
      });
    },

    function issueRequestTokenInQueryString(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};

      options.headers = {'X-Tenant-Id': '7777'};
      request('http://127.0.0.1:9000/?x-auth-token=dev', 'GET', null, options, function(err, res) {
        assert.ok(!err);
        assert.equal(res.statusCode, 200);
        callback();
      });
    },

    function issueRequestSkipAuthCache(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};

      options.headers = {'X-Tenant-Id': '7777'};
      request('http://127.0.0.1:9000/?x-auth-token=dev&skip-auth-cache=1', 'GET', null, options, function(err, res) {
        assert.ok(!err);
        assert.equal(res.statusCode, 200);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    assert.equal(reqCount, 4);
    test.finish();
  });
};
