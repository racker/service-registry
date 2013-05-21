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

export REPLICATION_FACTOR=1

make -C ./scripts/schema/ clean
make -C ./scripts/schema/ setup

sleep 0.5

cqlsh 127.0.0.1 9160 < ./scripts/schema/rproxy-combined.cql &
cqlsh 127.0.0.1 9160 < ./scripts/schema/farscape-combined.cql &

wait %1 %2

exit_code=$?

sleep 0.5

echo "Done"
exit $exit_code
