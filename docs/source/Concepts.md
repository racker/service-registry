# Concepts

## Service

A service represents an instance of a long running process on your server.
The client is responsible for sending heartbeats to indicate that the service is
still alive.

If a service is not heartbeated in the defined timeout interval, the
service is considered dead. When this happens, Service object is deleted
and a `service.timeout` event is inserted into the events feed.

Some example services include:

* API server instance
* Apache instance
* MySQL instance
* ZNC instance
* Long running Python / Ruby / Java application instance

## Configuration

Configuration enables clients to store arbitrary key/value pairs on the
server and get notified via an event feed when a value is updated or
deleted.

Each configuration key can contain a namespace. Namespaces allows you to
organize different (related) configuration values together in a hierarchical
manner. They also make retrieving a subset of configuration values easier
and more efficient.

If a key contains a namespace, you need to refer to it using a fully qualified
name which includes a namespace. For example, if a namespace is
/production/cassandra/ and the key name is listen_ip, fully qualified key
for this value is `/production/cassandra/listen_ip`.

Example of fully qualified configuration keys:

* cassandra_listen_ip (no namespace)
* cassandra_listen_port (no namespace)
* /production/cassandra/listen_ip (namespace is /production/cassandra/)
* /production/cassandra/listen_port (namespace is /production/cassandra/)

![Configuration Namespaces Visualized Using a Tree](/img/configuration_namespaces_tree_visualization.png)

Namespaces are also ephemeral which means they only exist if at least one
configuration value is stored under it.

When retrieving values from the API you differentiate between a namespace and
a configuration value based on the presence of a trailing forward slash. If a
trailing slash is present it's treated as a namespace otherwise it's treated 
as a configuration key.

For example:

* GET /configuration/production/casssandra/ - cassandra is treated as a
sub-namespace under namespace production.
* GET /configuration/production/cassandra - cassandra is treated as a key under
namespace production.

A configuration value is an opaque string and is treated as such in our
system.

## Events Feed

The events feed contains a list of events which occurred during the life-
time of your account. An event is inserted each time one of the following
incidents occur:

* A service is created
* A configuration value is updated
* A configuration value is removed
* A service times out

![Events feed visualized using a timeline](/img/events_feed_timeline_visualization.png)

A typical automation use case would be periodically polling the event feed
and acting on the returned events.

Note: When you long poll the event feed you are advised to use an HTTP/1.1
persistent connection instead of opening a new connection for every request.

## Event

An event represents a single event in the events feed. Each event object
has the following attributes:

* id
* timestamp
* type
* payload

## Id

All objects in the system are identified by a unique id. You'll use an
object's id when you want to perform certain operations on it. For example,
when you want to heartbeat a service you'll need to know the service id.
