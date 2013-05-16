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

var async = require('async');
var BatchInsert = require('cassandra-orm/lib/orm/batch_insert').BatchInsert;
var lowUUIDFromTimestamp = require('rackspace-shared-utils/lib/uuid').lowUUIDFromTimestamp;

var Metadata = require('../models/metadata').Metadata;
var getOne = require('./utils').getOne;
var getAll = require('./utils').getAll;
var settings = require('../../util/settings');
var errors = require('../../util/errors');


// creates metadata if it does not exist.
exports.getOne = function(ctx, key, callback) {
  getOne(Metadata)(ctx, key, key, {'includeChildren': false}, function(err, me) {
    var bi, meta;

    if (err && err instanceof errors.ObjectDoesNotExistError) {
      meta = new Metadata({_key: key});

      if (ctx.account && ctx.account.created_at) {
        meta.last_rectification = lowUUIDFromTimestamp(ctx.account.created_at).toString();
      }

      bi = new BatchInsert(ctx, meta.getKey());
      bi.begin();
      bi.save(meta);
      bi.commit(function(err) {
        callback(err, meta);
      });
    }
    else if (err) {
      callback(err, null);
    }
    else if (me) {
      callback(null, me);
    }
    else {
      callback(new Error('expected error or result'));
    }
  });
};


