from twisted.web import server, resource
from twisted.internet import reactor

from txServiceRegistry import Client

RACKSPACE_USERNAME = '' # your Rackspace username here
RACKSPACE_KEY = '' # your Rackspace API key here

client = Client(RACKSPACE_USERNAME,
                RACKSPACE_KEY,
                'us')

class Simple(resource.Resource):
    isLeaf = True
    def render_GET(self, request):
        return "<html>Hello, world!</html>"


def cbService(result):
    global heartBeater
    heartBeater = result[1]
    heartBeater.start()

payload = {'tags': ['api']}

d = client.services.register('web-service-api0', 30, payload)
d.addCallback(cbService)

site = server.Site(Simple())
reactor.listenTCP(8080, site)
reactor.run()
