/**
 *  Copyright 2012 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var util = require('util');
var net = require('net');
var tls = require('tls');
var Agent = require('http').Agent;
var SSLAgent = require('https').Agent;

/**
 * A special global instance which re-uses the same long-lived connection.
 */
function PersistentAgent(options) {
  var self = this;

  this.options = options || {};
  this.requests = {};
  this.sockets = {};
  this.freeSockets = {};
  this.maxSockets = 1;
  this.minSockets = 1;

  this.on('free', function(socket, host, port) {
    var name = host + ':' + port;

    if (self.requests[name] && self.requests[name].length) {
      // Pending requests
      self.requests[name].shift().onSocket(socket);
    }
    else {
      // No pending requests, re-use the socket
      if (!self.freeSockets[name]) {
        self.freeSockets[name] = [];
      }

      self.freeSockets[name].push(socket);
    }
  });
}

util.inherits(PersistentAgent, Agent);


PersistentAgent.prototype.createConnection = net.createConnection;
PersistentAgent.prototype.addRequestNoreuse = Agent.prototype.addRequest;

PersistentAgent.prototype.addRequest = function(req, host, port) {
  var name = host + ':' + port,
      self = this;

  req.useChunkedEncodingByDefault = false;

  if ((this.freeSockets[name] && this.freeSockets[name].length > 0) && !req.useChunkedEncodingByDefault) {
    // Re-use a socket
    var idleSocket = this.freeSockets[name].pop();

    if (idleSocket._onIdleError) {
      idleSocket.removeListener('error', idleSocket._onIdleError);
      delete idleSocket._onIdleError;
    }

    req._reusedSocket = true;
    req.onSocket(idleSocket);
  } else {

    if (Object.keys(this.sockets).length === 0 || (this.freeSockets[name] && this.freeSockets[name].length === 0)) {
      // No available sockets, this a probably a first request, create a new
      // socket.
      this.addRequestNoreuse(req, host, port);
      return;
    }

    // No free socket available, wait and try again
    setTimeout(function() {
      self.addRequest(req, host, port);
    }, 50);
  }
};

PersistentAgent.prototype.removeSocket = function(s, name, host, port) {
  var index;

  if (this.sockets[name]) {
    index = this.sockets[name].indexOf(s);

    if (index !== -1) {
      this.sockets[name].splice(index, 1);
    }
  }

  if (this.sockets[name] && this.sockets[name].length === 0) {
    delete this.sockets[name];
    delete this.requests[name];
  }

  if (this.freeSockets[name]) {
    index = this.freeSockets[name].indexOf(s);

    if (index !== -1) {
      this.freeSockets[name].splice(index, 1);

      if (this.freeSockets[name].length === 0) {
        delete this.freeSockets[name];
      }
    }
  }

  if (this.requests[name] && this.requests[name].length) {
    // If we have pending requests and a socket gets closed a new one
    // needs to be created to take over in the pool for the one that closed.
    this.createSocket(name, host, port).emit('free');
  }
};

function PersistentAgentSSL (options) {
  PersistentAgent.call(this, options);
}

util.inherits(PersistentAgentSSL, PersistentAgent);

PersistentAgentSSL.prototype.createConnection = createConnectionSSL;
PersistentAgentSSL.prototype.addRequestNoreuse = SSLAgent.prototype.addRequest;

function createConnectionSSL(port, host, options) {
  options.port = port;
  options.host = host;
  return tls.connect(port, host, options);
}

exports.PersistentAgent = PersistentAgent;
exports.PersistentAgentSSL = PersistentAgentSSL;
