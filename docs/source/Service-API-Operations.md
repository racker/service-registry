# Service API Operations

## Account

### Get Limits

This endpoint returns resource and rate limits that apply to your account.

Verb | URI | Description
---- | --- | -----------
GET | /limits | Returns account limits.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

#### Get Limits Response

[include="fixtures/response/limits-get.json", type="javascript"]

## Services

A service represents an instance of a long running process on your server.
The client is responsible for sending heartbeats to indicate that the service is
still alive.

### Attributes

[include="fixtures/swiz/service.md", type="swiz"]

`tag` field allows you to logically group services (e.g. tagging all the API
service instances with `www`) and retrieve a list of services for a particular
tag.

`metadata` field allows you to store arbitrary key-value pairs on a service
object. Common fields include:

* service instance version (e.g. git revision hash)
* service instance IP address
* service instance port
* service instance region
* status (e.g. enabled or disabled)

### List Services

Verb | URI | Description
---- | --- | -----------
GET | /services | Returns services for this account.

This endpoint returns a list of services on your account.

There are no required parameters for this call. You may filter returned
services by `tag` with the optional query parameter `tag`.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

#### List Services Response (no filters)

[include="fixtures/response/services-get.json", type="javascript"]

#### List Services Response (filtering on a tag - /services?tag=database)

[include="fixtures/response/services-tag-database-get.json", type="javascript"]

### Get Service

Verb | URI | Description
---- | --- | -----------
GET | /services/serviceId | Retrieves a single service.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

#### Get Service Response

[include="fixtures/response/services-dfw1-db1-get.json", type="javascript"]

### Create Service

Verb | URI | Description
---- | --- | -----------
POST | /services | Creates a new service.

Normal Response Code: (201) 'Location' header contains a link to the newly
created service.

Error Response Codes: 400, 401, 403, 500, 503

#### Service Create Request

[include="fixtures/request/services-post.json", type="javascript"]

#### Service Create Response

[include="fixtures/response/services-dfw1-api-heartbeat-post.json", type="javascript"]

### Update Service

Verb | URI | Description
---- | --- | -----------
PUT | /services/serviceId | Updates an existing service.

Normal Response Code: (204) This code contains no content with an empty
response body.

Error Response Codes: 400, 401, 403, 404, 500, 503

### Heartbeat a Service

Heartbeating is used for telling our service that the service is still
alive. The interval in which you need to hearbeat the service is dictated
by the `heartbeat_timeout` attribute on the service object.

For example, if you use a `heartbeat_timeout` of `30` seconds, this means
that you need to heartbeat the service every 30 seconds or more often.
Because of possible network delay and other factors, you are advised to
heartbeat your service at least 3 seconds sooner than the
`heartbeat_timeout`. In this example it would be every `27` seconds.

When you heartbeat a service, you are advised to use an
[HTTP/1.1 persistent connection](http://www.w3.org/Protocols/rfc2616/rfc2616-sec8.html)
instead of opening a new connection for every heartbeat request.

All of the official client libraries listed on the
[Client Libraries and Tools](client-libraries-and-tools-client-libraries) page
re-use the same HTTP connection when heartbeating a service.

__Heartbeating a service multiple times using the same token has an
undefined behavior.__

Verb | URI | Description
---- | --- | -----------
POST | /services/serviceId/heartbeat | Heartbeat a service.

Normal Response Code: (200), Response body contains a token which must be
used on the next heartbeat.

Error Response Codes: 400, 401, 403, 404, 500, 503

#### Service Heartbeat Request

[include="fixtures/request/service-dfw1-api-heartbeat-post.json", type="javascript"]

If this is a first heartbeat request for a service , body must include an
initial heartbeat token which has been returned when you created a service.
Otherwise you must include a token which was included in the previous
heartbeat response body.

#### Service Heartbeat Response

[include="fixtures/response/services-dfw1-api-heartbeat-post.json", type="javascript"]

Response body contains a token which you mean include next time you heartbeat
this service.

### Delete Service

Verb | URI | Description
---- | --- | -----------
DELETE | /services/serviceId | Deletes an existing service.

Normal Response Code: (204) This code contains no content with an empty
response body.

Error Response Codes: 400, 401, 403, 404, 500, 503

## Configuration

Configuration enables clients to store arbitrary key/value pairs on the
server and get notified via an event feed when a value is updated or
deleted.

A configuration value is an opaque string and is treated as such in our
system.

### Attributes

[include="fixtures/swiz/configuration_value.md", type="swiz"]

### List Configuration Values

Verb | URI | Description
---- | --- | -----------
GET | /configuration | Returns configuration values for this account.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

#### List Configuration Values

[include="fixtures/response/configuration-get.json", type="javascript"]

### List Configuration Values Under a Namespace

Verb | URI | Description
---- | --- | -----------
GET | /configuration/<namespace 1>/<namespace n>/ | Returns configuration values for the provided namespace and all the sub namespaces.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

__When retrieving all the configuration values under a namespace you need to
include a trailing slash after the last namespace. If you don't do that it will
be treated like you are retrieving a single configuration value.__

#### List Configuration Values Under a Namespace Response (GET /configuration/production/cassandra/)

[include="fixtures/response/configuration-get-for-namespace.json", type="javascript"]

### Get Configuration Value

Verb | URI | Description
---- | --- | -----------
GET | /configuration/configurationId | Retrieves a single configuration value.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

#### Get Configuration Value

[include="fixtures/response/configuration-configId-get.json", type="javascript"]

### Set Configuration Value

Verb | URI | Description
---- | --- | -----------
PUT | /configuration/configurationId | Sets a configuration value.

Normal Response Code: (204) This code contains no content with an empty
response body.

Error Response Codes: 400, 401, 403, 404, 500, 503

#### Configuration Value Set Request

[include="fixtures/request/configuration-configId-put.json", type="javascript"]

### Delete Configuration Value

Verb | URI | Description
---- | --- | -----------
DELETE | /configuration/configurationId | Deletes a configuration value.

Normal Response Code: (204) This code contains no content with an empty
response body.

Error Response Codes: 400, 401, 403, 404, 500, 503

## Events

Events feed contains a list of events which occurred during the life-time
of your account. Every time a service is created, a configuration
value is updated or removed, or a service times out, an event is inserted.

### Event Object Attributes

[include="fixtures/swiz/event.md", type="swiz"]

### Event Types

#### service.join

This event represents a new service joining the registry. The payload contains
a service object.

##### service.join Example Event Object

[include="fixtures/response/events-partial-service.join.json", type="javascript"]

#### service.remove

This event is inserted when a user deletes a service using an API call. The 
payload contains a deleted service object.

##### service.remove Example Event Object

[include="fixtures/response/events-partial-service.remove.json", type="javascript"]

#### service.timeout

This event represents a service timeout, which occurs when a client doesn't
heartbeat a service within the defined timeout. The payload contains a service
object.

##### service.timeout Example Event Object

[include="fixtures/response/events-partial-service.timeout.json", type="javascript"]

#### configuration_value.update

This event represents a configuration value being updated. The payload
contains the configuration value id, the old value, and the new value. If
this is the first time the value has been set, the old value will be `null`.

##### configuration_value.update Example Event Object

[include="fixtures/response/events-partial-configuration_value.update.json", type="javascript"]

#### configuration_value.remove

This event represents a configuration value being removed. The payload
contains the configuration value id and the old value.

##### configuration_value.remove Event Object

[include="fixtures/response/events-partial-configuration_value.remove.json", type="javascript"]

### List Events

Verb | URI | Description
---- | --- | -----------
GET | /events | Returns a list of events for this account.

There are no parameters for this call.

Normal Response Code: 200

Error Response Codes: 401, 403, 500, 503

A client can specify the optional `marker` query parameter. If the marker is
provided, only the events with ids that are newer or equal to the  marker are
returned. If no marker is provided, events from the last hour are
returned.

#### List Events Response

[include="fixtures/response/events-get.json", type="javascript"]
