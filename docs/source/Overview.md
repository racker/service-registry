# Overview

## What is Rackspace Service Registry

Rackspace Service Registry allows developers to build highly
available and responsive applications using a simple but powerful REST API.
Currently it exposes three groups of functionalities:

### Service Discovery

Find which services are currently online/active and find services based on
different criteria.

### Platform for Automation

Service Registry exposes an events feed which includes all of the events
that happened during the life-cycle of your account (e.g. service comes
online, configuration value gets updated, etc.).

Events feed is an information source about your infrastucture and can
be used to kick off a lot of different automation processes. Here are some
examples:

- Add a web service to a load-balancer when it comes online
- Open a ticket in the internal ticketing system when a service goes offline
- Re-initialize the connection pool inside your application when a
configuration value changes
- Boot a new Cloud Server with the service when a service times out

### Configuration Storage

Configuration storage allows users to store arbitrary configuration values
in our system and get notified via the events feed when a value gets
updated or deleted.

For more information about the basics of this API, refer to
[Concepts](concepts) chapter.

__Rackspace Service Registry is currently in a preview phase. If you want
to test it out, please fill out [this survey](https://surveys.rackspace.com/Survey.aspx?s=f3d6e51580ab4510a564487fafdafdfd)
and if you are qualified we will get back to you with the details on how to
start using the product.__

## Intended Audience

This document is intended for software developers interested in developing
applications that use the Rackspace Service Registry product. It
describes each API call, its associated options, and provides examples of
successful and failed responses.

To use the information provided here, you should first have a general
understanding of the Rackspace Service Registry service and have access
to an active Rackspace account. You should also be familiar with:

* RESTful web services
* HTTP/1.1
* JSON

## Additional Resources

You can download the most current version of this document from the
Rackspace Cloud website at [http://docs.rackspace.com/api/](http://docs.rackspace.com/api/).

For more information about Rackspace Cloud products, please refer to
[http://www.rackspace.com/cloud](http://www.rackspace.com/cloud). This site
also offers links to official Rackspace support channels, including
knowledge base articles, forums, phone, chat, and email.

You can also follow updates and announcements via twitter at
[http://www.twitter.com/rackspace](http://www.twitter.com/rackspace).

This API uses standard HTTP 1.1 response codes as documented at
[http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html](http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html).
