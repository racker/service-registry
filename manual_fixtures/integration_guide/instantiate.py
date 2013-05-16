from txServiceRegistry.client import Client
from twisted.internet import reactor

RACKSPACE_USERNAME = '' # your username here
RACKSPACE_KEY = '' # your API key here
SERVICE_REGISTRY_URL = 'https://dfw.registry.api.rackspace.com/v1.0/'

client = Client(username=RACKSPACE_USERNAME,
                apiKey=RACKSPACE_KEY,
                baseUrl=SERVICE_REGISTRY_URL,
                region='us')
