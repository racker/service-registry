var async = require('async');
var express = require('express');

var request = require('util/request').request;
var testUtil = require('util/test');


exports.test_tracing_request_and_response_middleware = function(test, assert) {
  // todo: test is behaving differently per backend. disabling for now.
  test.skip();
  
  var server1, server2, receivedTracesCount = 0;

  async.waterfall([
    function startBackendServer(callback) {
      testUtil.getTestHttpServer(9001, '127.0.0.1', function(err, _server) {
        server1 = _server;

        server1.get('/test', function(req, res) {
          // Make sure trace id is propagated to the backend
          var missingHeaders = [];
          ['x-b3-traceid', 'x-b3-spanid', 'x-b3-parentspanid'].forEach(function(header) {
            if (!req.headers.hasOwnProperty(header)) {
              missingHeaders.push(header);
            }
          });
          
          if (missingHeaders.length === 0) {
            res.writeHead(200, {});
          } else {
            res.writeHead(500, {'X-missing-headers': missingHeaders.join(',')});
          }
          res.end();
        });

        callback();
      });
    },

    function startMockRESTkinServer(callback) {
      server2 = express.createServer();

      server2.use(express.bodyParser());
      server2.post('/11111/trace', function(req, res) {
        var trace = req.body[0], traceHeaders, problems = [],
            headerKeys = ['sr',
                          'http.uri',
                          'http.request.headers',
                          'http.request.remote_address',
                          'rax.tenant_id',
                          'http.response.code',
                          'ss'];

        receivedTracesCount++;

        // todo: this should probably be treated as a black box.
        
        if (receivedTracesCount === 1) {
          // First trace should have 7 annotations
          // 1. Server receive
          // 2. request url
          // 3. request headers
          // 4. request origin remote address
          // 5. user id
          // 5. response status code
          // 7. server send
          if (trace.annotations.length !== 7) {
            problems.push('Invalid number of annotations(' + trace.annotations.length + ')');
          } else {
            headerKeys.forEach(function(key, index) {
              if (trace.annotations[index].key !== key) {
                problems.push('missing ' + key);
              }
            });
          }

          // Verify that headers have been correctly sanitized
          traceHeaders = (trace.hasOwnProperty('annotations') && trace.annotations[2]) ? JSON.parse(trace.annotations[2].value) : {};
          if (traceHeaders.hasOwnProperty('foo')) {
            problems.push('contained header foo');
          }
          if (traceHeaders.hasOwnProperty('moo')) {
            problems.push('contained header moo');
          }
          if (!traceHeaders.hasOwnProperty('bar')) {
            problems.push('did not contain header bar');
          }
        }
        else if (receivedTracesCount === 2) {
          ['cs','cr'].forEach(function(header, index) {
            if (!trace.annotations[index] || trace.annotations[index].key !== header) {
              problems.push('missing ' + header);
            }
          });
        }

        if (problems.length > 0) {
          res.writeHead(500, {'X-trace-errors': problems.join(',')});
        }
        res.end();
      });

      server2.listen(4567, '127.0.0.1', callback);
    },

    function issueRequestSuccess(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200],
                     'headers': {
                       'foo': 'bar',
                       'bar': 'baz',
                       'mOO': 'ponies',
                       'X-Tenant-Id': '99999',
                       'X-Auth-Token': 'dev9'
                     }
      };

      request('http://127.0.0.1:9000/test', 'GET', null, options, function(err, res) {
        if (res.statusCode !== 200) {
          console.log(res.headers);
        }
        assert.equal(res.statusCode, 200);

        setTimeout(callback, 1500);
      });
    },

    function issueRequestRESTkinBackendIsDown(callback) {
      var options = {'return_response': true, 'expected_status_codes': [200],
                     'headers': {
                       'foo': 'bar',
                       'bar': 'baz',
                       'mOO': 'ponies',
                       'X-Tenant-Id': '99999',
                       'X-Auth-Token': 'dev9'
                     }
      };

      server2.close();
      server2 = null;

      // RESTkin server being unavailable shouldn't result in service
      // interruption
      request('http://127.0.0.1:9000/test', 'GET', null, options, function(err, res) {
        assert.equal(res.statusCode, 200);

        setTimeout(callback, 1000);
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
    
    assert.ifError(err);

    // Should receive two traces - serverRecv, clientSend
    assert.equal(receivedTracesCount, 2);
    test.finish();
  });
};
