var http = require('http');

var async = require('async');
var Client = require('service-registry-client/lib/client').Client

var username = ''; // your username here
var key = ''; // your API key here

function main() {
  var client = new Client(username, key, 'us', null);

  async.waterfall([
    function startHttpServer(callback) {
      var server = http.createServer(function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Hello, world!');
      };

      server.listen(8080, '127.0.0.1', callback);
    },

    function createService(callback) {
      var payload = {'tags': ['api']};

      client.services.register('web-service-api0', 30, payload, function(err, resp, hb) {
        callback(null, hb);
      });
    },

    function startHeartbeating(hb, callback) {
      hb.start();
      callback();
    }
  ],

  function(err) {
    if (err) {
      console.log('An error has occurred.');
      console.log(err);
    }
  });
}

main();
