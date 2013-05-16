function createService(callback) {
  client.services.create('web-service-api0', 30, {}, function(err, resp, hb) {
    callback();
  });
}
