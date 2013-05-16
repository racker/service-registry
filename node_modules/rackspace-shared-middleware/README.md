# Rackspace Shared Express Middleware

Shared Rackspace Express middleware.

# Build status

[![Build Status](https://secure.travis-ci.org/racker/node-rackspace-shared-middlewares.png)](http://travis-ci.org/racker/node-rackspace-shared-middlewares)

# Available middleware

## Access Logger

Log express access attempts using logamgic.

## Transaction ID

Attaches transaction id to every request and return it in the response inside
the X-Response-Id header.

## Body size limiter

Middleware which accepts and limits the maximum size of the request body.

## Allow JavaScript XHR

A middleware which responds to any OPTIONS requests with a 204 and an Access control Response.

## Body parser

Middleware which uses Swiz definitions to parse a request body.

## Validator

A middleware which deserializes the request body and performs a validation on
it using the provided Valve object. This middleware must be used in combination
with body parser one.

## Timing

A middleware which uses instruments library to record how long the request
processing took.

# License

This library is distributed under the [Apache 2.0 license](http://www.apache.org/licenses/LICENSE-2.0.html).
