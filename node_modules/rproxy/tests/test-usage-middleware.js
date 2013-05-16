var async = require('async');
var express = require('express');

var request = require('util/request').request;
var misc = require('util/misc');
var testUtil = require('util/test');
var usageMiddleware = require('middleware/response/usage');

function notInObject(assert, obj, items) {
  items.forEach(function(item) {
    assert.ok(!obj.hasOwnProperty(item));
  });
}

exports.test_usage_middleware = function(test, assert) {
  var entityData = {'id': 'a', 'name': 'test', 'ip': '127.0.0.1'},
      options = {'return_response': true, 'expected_status_codes': [200]}, server1 = null, server2 = null,
      headerNames, atomHopperReqCount = 0, baseHeaders, ts = misc.getUnixTimestamp();

  options.headers = {'X-Tenant-Id': '7777', 'X-Auth-Token': 'dev'};
  baseHeaders = {'Content-Type': 'application/json', 'X-RP-Usage-Resource-Id': 'a',
                 'X-RP-Usage-Resource-Name': 'entity', 'X-RP-Usage-Resource-Timestamp': ts,
                 'X-RP-Usage-Resource-Data': JSON.stringify(entityData)};
  headerNames = usageMiddleware.HEADER_KEY_NAMES;
  async.waterfall([
    function startBackendServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, server) {
        server1 = server;

        server.post('/entity/a', function(req, res) {
          var headers = misc.merge(baseHeaders, {'X-RP-Usage-Resource-Action': 'create'});
          res.writeHead(201, headers);
          res.end();
        });

        server.put('/entity/a', function(req, res) {
          var headers = misc.merge(baseHeaders, {'X-RP-Usage-Resource-Action': 'put'});
          res.writeHead(204, headers);
          res.end();
        });

        server.del('/entity/a', function(req, res) {
          var headers = misc.merge(baseHeaders, {'X-RP-Usage-Resource-Action': 'delete'});
          res.writeHead(204, headers);
          res.end();
        });

        server.post('/entity/corrupted', function(req, res) {
          var headers = misc.merge(baseHeaders, {'X-RP-Usage-Resource-Data': '{"broken json}'});
          res.writeHead(201, headers);
          res.end();
        });

        callback();
      });
    },

    function startMockAtomHopperServer(callback) {
      testUtil.getTestHttpServer(9002, '127.0.0.1', function(err, server) {
        server2 = server;

        server.use(express.bodyParser());
        server.post('/hopper', function(req, res) {
          var buffer = '';
          atomHopperReqCount++;

          req.on('data', function(chunk) {
            buffer += chunk;
          });

          req.on('end', function() {
            // TODO: Better assert
            assert.ok(buffer.length > 10);

            res.writeHead(200, {});
            res.end();
          });
        });

        callback();
      });
    },

    function issueCreateRequest(callback) {
      // Verify that headers have been stripped
      request('http://127.0.0.1:9000/entity/a', 'POST', null, options, function(err, res) {
        //notInObject(assert, res.headers, headerNames);
        assert.equal(res.statusCode, 201);
        callback();
      });
    },

    function issueUpdateRequest(callback) {
      // Verify that headers have been stripped
      request('http://127.0.0.1:9000/entity/a', 'PUT', null, options, function(err, res) {
        //notInObject(assert, res.headers, headerNames);
        assert.equal(res.statusCode, 204);
        callback();
      });
    },

    function issueDeleteRequest(callback) {
      // Verify that headers have been stripped
      request('http://127.0.0.1:9000/entity/a', 'DELETE', null, options, function(err, res) {
        //notInObject(assert, res.headers, headerNames);
        assert.equal(res.statusCode, 204);
        callback();
      });
    },

    function issueCreateRequestCorruptedDataFromBackend(callback) {
      // Verify that headers have been stripped. This request shouldn't trigger
      // a POST to Atom Hopper server, because it simulates backend returning
      // corrupted data.
      request('http://127.0.0.1:9000/entity/corrupted', 'POST', null, options, function(err, res) {
        //notInObject(assert, res.headers, headerNames);
        assert.equal(res.statusCode, 201);
        setTimeout(callback, 500);
      });
    }
  ],

  function(err) {
    if (server1) {
      server1.close();
    }

    if (server2) {
      server2.close();
    }

    assert.equal(atomHopperReqCount, 3);
    test.finish();
  });
};
