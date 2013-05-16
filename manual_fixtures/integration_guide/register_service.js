var heartbeatTimeout = 15;
var payload = {'tags': ['tag1', 'tag2', 'tag3']};

client.services.register('serviceId', heartbeatTimeout, payload,
                         null, function(err, resp) {});
