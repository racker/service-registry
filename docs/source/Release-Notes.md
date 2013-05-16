# Release Notes

## v2.0, March, 2013

### Backward incompatible changes

#### Merging of Sessions and Services

To make the API simpler, more user friendly and geared towards a common use
case, "Session" object has been merged with the "Service" object.

The following attributes have moved from Session to Service object:

* heartbeat_timeout
* last_seen

All the "session" API endpoints have been removed and you now heartbeat a service
instead of a session.

As a consequence services.timeout event has been renamed to service.timeout
and the payload attribute now contains Service object which has timed out.

Note: This change is backward incompatible.

If you are using an official client library you need to upgrade to version 0.2.0
and update your code which calls the client library.

### Product Features

Added new service.remove event. This event is inserted when a user explicitly
removes a service using an API call.

This event allows users to distinguish between an implicit service timeout and
explicit service removal triggered by a user.

## v1.1, February, 2013

### Product Features

#### Configuration Namespaces

Added support for namespaces to the configuration API.

Namespace allows you to organize different (related) configuration values
together in a hierarchical manner. They also make retrieving a subset of
configuration values easier and more efficient.

For more information, please see the [Concepts](concepts) section.

### Improvements, bug fixes

#### Improved reliability and decreased response times for most of the API operations

Improved reliability and performance and decreased response times for the
"heartbeat" and all of the "list" operations.

## v1.0, November 5, 2012

These release notes correspond to the Preview for Rackspace Service
Registry.

### Product Features

#### Service Registration and Discovery

Register services in the registry and get notifications via the events feed when
a service comes online or times out.

#### Notifications via the Events Feed

Events feed contains events which happened during a life-cycle of your account.
Events include service coming online, service timing out, configuration value
getting updated and configuration value getting removed.

#### Configuration Storage

Store configuration values (arbitrary key-value pairs) in the centralized
place and get notifications via the event feed when a value is updated or
removed.

#### Client Libraries for Four Programming Languages

Preview release includes official client libraries for the following languages:

* Python
* Twisted Python
* Java
* Node.js
