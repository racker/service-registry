var async = require('async');
var express = require('express');

var request = require('util/request').request;
var misc = require('util/misc');
var testUtil = require('util/test');

exports.test_header_remover_middleware = function(test, assert) {
  var server = null;

  async.waterfall([
    function startBackendServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server = _server;

        server.get('/test', function(req, res) {
          var headers = {'x-test-1': 'test', 'x-test-2': 'test2', 'x-something': 'test', 'x-test-bar': 'foo'};
          res.writeHead(200, headers);
          res.end();
        });

        callback();
      });
    },

    function issueRequest(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200]};

      request('http://127.0.0.1:9000/test', 'GET', null, options, function(err, res) {
        assert.equal(res.headers['x-something'], 'test');
        assert.ok(!res.headers.hasOwnProperty('x-test-1'));
        assert.ok(!res.headers.hasOwnProperty('x-test-2'));
        assert.ok(!res.headers.hasOwnProperty('x-test-bar'));
        assert.equal(res.statusCode, 200);
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
