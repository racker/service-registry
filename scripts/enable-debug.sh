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

if [ $DEBUG ] ;
then
  echo "Sending SIGUSR1 signal to node process"
  ps -ef | grep -i "bin/public-api-server"| grep -v grep | awk '{print $2}' | xargs kill -s USR1
else
  echo "Debug not enable, not sending signal"
fi

exit 0
