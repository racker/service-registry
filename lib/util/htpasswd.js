/**
 *  Copyright 2013 Rackspace
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

var fs = require('fs');
var crypto = require('crypto');

var log = require('logmagic').local('farscape.htpasswd');
var async = require('async');

function Htpasswd() {
  this.hashes = {};
}

/**
 * gets the hash of a particular user.
 * @param {String} user to lookup.
 * @return {String} the hash of the user or null.
 */
Htpasswd.prototype.getHash = function(user) {
  return this.hashes[user];
};

/**
 * checks to see is password hashes usuing a number of algorithms.
 * @param {String} user user name.
 * @param {String} pass password.
 * @return {boolean} true if hash was found.
 */
Htpasswd.prototype.doesValidate = function(user, pass) {
  var validates = false,
      hash = this.getHash(user);
  if (!hash) {
    validates = false;
  } else {
    exports.validators.forEach(function(validator) {
      if (!validates) {
        validates = validator(pass, hash);
      }
    });
  }
  return validates;
};




// much of this was copied from https://github.com/racker/dreadnot/blob/master/lib/web/auth.js, which is Apache Licensed.

var AP_MD5PW_ID  = "$apr1$";

var ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

var TUPLES = [
  [0, 6, 12],
  [1, 7, 13],
  [2, 8, 14],
  [3, 9, 15],
  [4, 10, 5],
];

function sha1crypt(password) {
  return '{SHA}' + crypto.createHash('sha1').update(password).digest('base64');
}

// Ported to javascript from http://code.activestate.com/recipes/325204-passwd-file-compatible-1-md5-crypt/
function md5crypt(password, salt, magic) {
  var rearranged = '',
      mixin, final, m, v, i;

  m = crypto.createHash('md5');
  m.update(password + magic + salt);
  mixin = crypto.createHash('md5').update(password + salt + password).digest();

  for (i = 0; i < password.length; i++) {
    m.update(mixin[i % 16]);
  }

  // Weird shit..
  for (i = password.length; i > 0; i >>= 1) {
    if (i & 1) {
      m.update('\x00');
    } else {
      m.update(password[0]);
    }
  }

  final = m.digest();

  // Slow it down there...
  for (i = 0; i < 1000; i ++) {
    m = crypto.createHash('md5');

    if (i & 1) {
      m.update(password);
    } else {
      m.update(final);
    }

    if (i % 3) {
      m.update(salt);
    }

    if (i % 7) {
      m.update(password);
    }

    if (i & 1) {
      m.update(final);
    } else {
      m.update(password);
    }

    final = m.digest();
  }


  for (i = 0; i < TUPLES.length; i++) {
    v = final.charCodeAt(TUPLES[i][0]) << 16 | final.charCodeAt(TUPLES[i][1]) << 8 | final.charCodeAt(TUPLES[i][2]);
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
  }

  v = final.charCodeAt(11);
  rearranged += ITOA64[v & 0x3f]; v >>= 6;
  rearranged += ITOA64[v & 0x3f]; v >>= 6;

  return magic + salt + '$' + rearranged;
}

function validateSHA(pass, hash) {
  return sha1crypt(pass) === hash;
}

function validateMD5(pass, hash) {
  // splits into 4 parts:  <nothing>,apr1,salt,hash
  var all = hash.split('$');
  if (all.length < 4) {
    return false;
  } else {
    return md5crypt(pass, all[2], '$apr1$') === hash;
  }
}

/**
 * load a htpasswd file into the library.
 * @param {String} path to load from.
 * @return {Htpasswd} htpasswd object.
 */
exports.loadSync = function(path) {
  var htpasswd = new Htpasswd();
  
  if (!fs.existsSync(path)) {
    return htpasswd;
  }
  
  var data = fs.readFileSync(path, 'utf8'),
      lines = [],
      start = 0,
      ptr = 0;
  while (ptr < data.length) {
    if (data.charCodeAt(ptr) === 10) {
      lines.push(data.substring(start, ptr));
      ptr += 1;
      start = ptr;
    } else {
      ptr += 1;
    }
  }
  if (start < ptr) {
    lines.push(data.substring(start, ptr));
  }
  lines.forEach(function(line) {
    var parts = line.split(':');
    if (parts.length >= 2) {
      htpasswd.hashes[parts[0]] = parts[1];
    } else {
      log.debug('Invalid htpasswd line:', {line: line});
    }
  });
  return htpasswd;
};

exports.validators = [
  validateSHA,
  validateMD5
];

exports.Htpasswd = Htpasswd;

