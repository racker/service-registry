# Integration Instructions

This document will explain how to integrate Rackspace Service Registry clients,
into your applications and also contains an example on how to integrate
the Twisted Python client into your Twisted-powered application.

## General Flow

The general flow when registering a service with Rackspace Service Registry is:

* Create a service.
* Heartbeat the service to maintain it.

Once you've done those things, you'll have a service in Rackspace Service
Registry  and you will be able to utilize features such as the Events feed,
which contains events for when a service has joined, when it has timed out,
and more.

### Create a Service

The first thing you will want to do when using the Rackspace Service Registry
is create a service.

As described in the Service section of the [Concepts](concepts) chapter, service
represents an arbitrary long running process on your server.

To create a service, POST to /services, replacing "1234" with your account
ID number, and using the auth token returned by the auth API. The request
body must contain `heartbeat_timeout` in the range of 3-120 seconds, and may
contain optional tags and metadata (key/value pairs) attribute.

```shell
POST /v1.0/1234/services HTTP/1.1
Host: dfw.registry.api.rackspacecloud.com
Accept: application/json
X-Auth-Token: eaaafd18-0fed-4b3a-81b4-663c99ec1cbb
```

#### Create Service Request Body

[include="fixtures/request/services-post.json", type="javascript"]

#### Create Service Response

[include="fixtures/response/services-dfw1-api-heartbeat-post.json", type="javascript"]

It contains the initial token which you can use to start heartbeating it.

Let's say you also added a service called 'dfw1-api' without any tags
or metadata. If you GET /services, you should see this:

#### GET /services Response

[include="fixtures/response/services-get.json", type="javascript"]

You can also GET services by tag:

```shell
GET /v1.0/1234/services?tag=database HTTP/1.1
Host: dfw.registry.api.rackspacecloud.com
Accept: application/json
X-Auth-Token: eaaafd18-0fed-4b3a-81b4-663c99ec1cbb
```

and the response would look like this:

#### Get Services By Tag Response

[include="fixtures/response/services-tag-database-get.json", type="javascript"]

To change the dfw1-db1 service (for example, update its metadata),
you can do an HTTP PUT request to /services/dfw1-db1 with a body that
contains the new metadata that you'd like the service to have.

### Heartbeat the Service

Heartbeating is as simple as POSTing to /services/<service ID>/heartbeat
with the token as the body.

```shell
POST /v1.0/1234/services/dfw1-api/heartbeat HTTP/1.1
Host: dfw.registry.api.rackspacecloud.com
Accept: application/json
X-Auth-Token: eaaafd18-0fed-4b3a-81b4-663c99ec1cbb
```

The request body would look like this:

#### Heartbeat Service Request Body

[include="fixtures/response/services-dfw1-api-heartbeat-post.json", type="javascript"]

And the response body would look the same, except that the token would be
different. You could then use the new token to heartbeat once again.

There are client libraries that abstract away heartbeating so that when you
create a service, you get an object back that heartbeats for you
automatically. We will see that in the Twisted Python client in the next
section.

## Using the Twisted Python Client

All of the Service Registry functionality has been abstracted away in various
clients for popular programming languages such as Java, Node.js, and Python. In
this section, we'll see how to use the Twisted Python client to go through
the same flow of creating a service and heartbeating it.

### Installing the Client

The client is available in the
[Python Package Index](https://pypi.python.org/pypi). To install, you can do:

```shell
pip install txServiceRegistry
```

### Create a Service (Python)

In order to create a service using the Twisted Python client, we first have
to instantiate a client to interact with the Rackspace Service Registry:

#### Instantiate the Client (Python)

[include="manual_fixtures/integration_guide/instantiate.py", type="python"]

The region keyword argument above determines which Rackspace authentication
URL the client will use to authenticate. You can specify either 'us' or
'uk'.

Now that we've created a Client object, we can use it to work with the
Rackspace Service Registry API. Creating a service is straightforward:

#### Register Service (Python)

[include="manual_fixtures/integration_guide/register_service.py", type="python"]

### Heartbeat the Service (Python)

When creating a service using the Twisted client, the result contains the
response body (which contains the initial token required for heartbeating it),
and a HeartBeater object. The HeartBeater object allows us to automatically
heartbeat the service by calling the start() method:

#### Heartbeat Service Using Heartbeater (Python)

```python
heartbeater.start()
```

This causes the HeartBeater object to start heartbeating automatically,
using the initial token. It will heartbeat the service, get the next token,
and heartbeat the service again continuously until the stop() method is
called.

You may also heartbeat the service manually like so:

#### Heartbeat Service Manually (Python)

[include="manual_fixtures/integration_guide/heartbeat.py", type="python"]

### Integration Example

Here is a short example of a web server that registers with the Cloud
Service Registry on startup, and uses the HeartBeater object while it is
running in order to maintain the service:

#### A Web Server That Uses Service Registry (Python)

[include="manual_fixtures/integration_guide/web_server.py", type="python"]

The code above is a simple web server that responds with "<html>Hello,
world!</html> on every GET request. The code that interacts with the Cloud
Service Registry can be explained as follows:

First, the server creates a servicewith a heartbeat interval of 30. Since
client.services.create() returns a Twisted Deferred, a callback must be
added to it in order to use the result. This is done here:

#### Create a Service (Python)

```python
payload = {'tags': ['api']}

d = client.services.register('web-service-api0', 30, payload)
d.addCallback(cbService)
```

The cbService function takes the result of client.services.create() as an
argument and starts the HeartBeater.

## Using the Node.js Client

### Installing the Client

The client is available in [npm](https://npmjs.org/). To install, you can do:

```shell
npm install service-registry-client
```

### Create a Service (Javascript)

In order to create a service using the Node.js client, we first have
to instantiate a client to interact with the Rackspace Service Registry:

#### Instantiate the Client (Javascript)

[include="manual_fixtures/integration_guide/instantiate.js", type="javascript"]

The region keyword argument above determines which Rackspace authentication
URL the client will use to authenticate. You can specify either 'us' or
'uk'.

Now that we've created a Client object, we can use it to work with the
Rackspace Service Registry API. Creating a service is straightforward:

#### Register Service (Javascript)

[include="manual_fixtures/integration_guide/register_service.js", type="javascript"]

### Heartbeat the Service (Javascript)

When creating a service using the Node.js client, the result contains the
response body (which contains the initial token required for heartbeating the
service), and a HeartBeater object. The HeartBeater object allows us to
automatically heartbeat the service by calling the start() method:

#### Heartbeat Service Using Heartbeater (Javascript)

```Javascript
heartbeater.start();
```

This causes the HeartBeater object to start heartbeating automatically,
using the initial token. It will heartbeat the service, get the next token,
and heartbeat the sevice again continuously until the stop() method is
called.

You may also heartbeat the service manually like so:

#### Heartbeat Service Manually (Javascript)

[include="manual_fixtures/integration_guide/heartbeat.js", type="javascript"]

### Integration Example

Here is a short example of a web server that registers with the Cloud
Service Registry on startup, and uses the HeartBeater object while it is
running in order to maintain the service:

#### A Web Server That Uses Service Registry (Javascript)

[include="manual_fixtures/integration_guide/web_server.js", type="javascript"]

The code above is a simple web server that responds with "Hello, world!"
The code that interacts with the Rackspace Service Registry can be
explained as follows:

First, the script creates a service with a heartbeat interval of 30.

#### Create Service in Web Server

[include="manual_fixtures/integration_guide/web_server_register_service.js", type="javascript"]

This function also calls start() on the HeartBeater object that is returned
when creating a service.
