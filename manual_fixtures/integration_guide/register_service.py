def cb(result):
    print('Service has been created')

heartbeatTimeout = 15
payload = {'tags': ['tag1', 'tag2', 'tag3']}
d = client.services.register('serviceId', heartbeatTimeout, payload)
d.addCallback(cb)

reactor.run()
