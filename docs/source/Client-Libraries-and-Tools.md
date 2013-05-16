# Client Libraries and Tools

This section describes the client libraries and tools that you can use to
interact with the API.

## Client Libraries

### Node.js

The official Node.js library which allows you to interact with the API can
be found at [https://github.com/racker/node-service-registry-client](https://github.com/racker/node-service-registry-client).

#### Installation

```shell
npm install service-registry-client
```

### Twisted Python

The official Twisted Python library which allows you to interact with the
API can be found at [https://github.com/racker/python-twisted-service-registry-client](https://github.com/racker/python-twisted-service-registry-client).

#### Installation

```shell
pip install txServiceRegistry
```

### Python

The official Python library which allows you to interact with the
API can be found at [https://github.com/racker/python-service-registry-client](https://github.com/racker/python-service-registry-client).

#### Installation

```shell
pip install service-registry-client
```

### Java

The official Java library which allows you to interact with the API can be
found at [https://github.com/racker/java-service-registry-client](https://github.com/racker/java-service-registry-client).

## Best Practices for Writing Client Libraries

This section describes best practices which you should follow if you are
building a custom client library.

### Use Persistent Connections

HTTP/1.1 defines persistent connections which you should use when talking with
the API.

This is especially important when you are sending heartbeats and polling the
events feed. Instead of opening a new TCP connection when you are sending a
heartbeat or polling the events feed, re-use the existing connection. This is
more efficient for both the client and the server.

### Make Sure to Re-authenticate with the Auth API

When the Service Registry API returns 401, you should try to re-authenticate
with the Auth API and retrieve a new token. A 401 can either mean that you
supplied an invalid token or that the token has expired.

The Auth API returns a token expiration time with the "obtain token" response,
but some times, for various reasons, tokens are purged before the actual
expiration time.

This is especially important because of the nature of this service. Code
hitting the Service Registry API won't be located in a run-once-script but
rather inside long-running processes constantly hitting the API.

### Cache the List of Available Services

To avoid interruptions in your service because of minor hiccups on your or our
side you should cache the list services response in your client.

This will allow you to retrieve a (potentially stale) list of services from the
cache in case a minor service interruption occurs.

### Retry Heartbeating on Non-404 Errors

If the API endpoint returns a non 404 error (e.g 500) when heartbeating a
service, you should immediately try to re-send the heartbeat. The error could
indicate an intermediate instead of an actual issue.

## Tools

### Command Line Client

Command Line Client allows you to perform different read and write operation on
your accounts including listing of the events and updating configuration values.
For a full list of functionality, please visit the project Github page at
[https://github.com/racker/python-service-registry-cli](https://github.com/racker/python-service-registry-cli).

#### Installation

Client library is installed using `pip` Python package manager.

```shell
pip install service-registry-cli
```

#### Usage

For a list of the available commands, run the following command in your
terminal:

```shell
raxsr --help
```

To view available options for a command, run the following command in your
terminal:

```shell
raxsr help <resource> <action>
```

```shell
raxsr help events list
```

### Long Running Process Wrapper

This tool written in Node.js allows you to wrap and register arbitrary
long-running process inside the service registry. It works by executing a new
process for the long-running process you want to wrap and registering it in the
service registry.

If the wrapped process dies, the wrapper itself also exits which will cause
the service to eventually expire (how long it takes depends on the heartbeat
interval).

#### Installation

```shell
npm install service-registry-process-wrapper
```

#### Usage

```shell
service-registry-wrapper --id=<service id> --tags=<comma separated list of tags> \
          --metadata=<comma separated list of key=value pairs> \
          --interval=<heartbeat interval> [--abort-on-failure] \
          <path to the process which is being wrapped> <process arguments>
```

For example:

```shell
service-registry-wrapper --id=my-host1-api0 --tags=api,www
          --metadata=port=8000,host=localhost,is_public=true \
          --interval=20  \
          /opt/my-app/bin/api --port=8000 --host=localhost
```

__Process Wrapper is a good way to register services written in programming
languages for which the client library is not available or for the services you
don't have the access to the source code or it would be to impractical to modify
it (for example Apache, MySQL, etc.). If you have access to the source code and
the client library is available you are advised to use the client library to
integrate with the Service Registry. This approach offers the most fine
grained control over when to register a service and when to stop sending
heartbeats.__
