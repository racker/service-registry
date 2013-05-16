var Client = require('service-registry-client').Client;

var username = ''; // your username here
var key = ''; // your API key here
var service_registry_url = 'https://dfw.registry.api.rackspace.com/v1.0/';

var client = new Client(username, key, 'us', {'url': service_registry_url});
