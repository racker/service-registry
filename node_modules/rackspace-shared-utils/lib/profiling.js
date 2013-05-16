/*
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


/**
 * Generate statistics from the Cassandra profiling .data
 *
 * @param {Object} cassandraQueries data Cassandra queries data.
 * @return {Object} Object Formatted data.
 */
exports.formatCassandraProfilingData = function(cassandraQueries) {
  var total = {},
      topByUsage = [],
      topByTime = [],
      query;

  // Populate Cassandra query statistics
  cassandraQueries.forEach(function(obj) {
    var query = obj.query;

    topByTime.push(obj);
    if (!total.hasOwnProperty(query)) {
      total[query] = 0;
    }

    total[query]++;
  });

  for (query in total) {
    if (total.hasOwnProperty(query)) {
      topByUsage.push({query: query, used: total[query]});
    }
  }

  topByUsage.sort(function(a, b) {
    return (b.used - a.used);
  });

  topByTime.sort(function(a, b) {
    return (b.work.stopTime - b.work.startTime) - (b.work.stopTime - b.work.startTime);
  });

  topByUsage = topByUsage.splice(0, 5);
  topByTime = topByTime.splice(0, 5);

  return {
    'queries': {
      'top_5_used': topByUsage,
      'top_5_time': topByTime
    }
  };
};


/**
 * Utility function for returning Cassandra query type.
 *
 * @param {String} query Cassandra CQL query.
 * @return {String} Query type.
 */
exports.getQueryType = function(query) {
  if (query.indexOf('USE') === 0) {
    return 'use_keyspace';
  }
  else if (query.indexOf('SELECT') === 0) {
    return 'select';
  }
  else if (query.indexOf('UPDATE') === 0) {
    return 'update';
  }
  else if (query.indexOf('DELETE') === 0) {
    return 'delete';
  }
  else if (query.indexOf('BATCH') !== -1) {
    return 'batch';
  }

  return 'unknown';
};
