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

# Start all the processes

scripts/run-dev.sh &

sleep 20

scripts/generate-request-response-fixtures.js --out=$1

# Send SIGINT to whiskey
kill -SIGINT $(ps aux | grep -i 'whiskey' | grep -v grep | awk '{print $2}')
