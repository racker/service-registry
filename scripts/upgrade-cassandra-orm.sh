#!/bin/bash
#
# Copyright 2013 Rackspace
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

BASEDIR=`dirname $0`
ORM_DIRECTORY=$1

if [ ! $ORM_DIRECTORY ]; then
  echo "First argument must be path to cassandra-orm repo"
  exit 1
fi

rm -rf $BASEDIR/../node_modules/cassandra-orm
cp -r ${ORM_DIRECTORY} $BASEDIR/../node_modules/cassandra-orm
rm -rf $BASEDIR/../node_modules/cassandra-orm/.git
rm  $BASEDIR/../node_modules/cassandra-orm/*.log
git add $BASEDIR/../node_modules/cassandra-orm
git ci -m "Upgrade cassandra-orm."
