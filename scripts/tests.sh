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

TYPE=$1
CONFIG="tests/dependencies-dev.json"
WITH_RECTIFIER=${WITH_RECTIFIER:="yes"}

if [ ${TYPE} = "all" ]; then
  TYPE=""
fi

if [ $TRAVIS ]; then
  DEPENDENCIES_FILE="tests/dependencies-base-travis.json"
  TIMEOUT=80000
else
  TIMEOUT=60000
  DEPENDENCIES_FILE="tests/dependencies-base.json"
fi

if [ ${WITH_RECTIFIER} = "yes" ]; then
  DEPENDENCIES_FILE="$DEPENDENCIES_FILE,tests/dependencies-rectifier.json"
  echo "Running with rectifier service"
else
  echo "Running without rectifier service"
fi

if [ ! $TEST_FILES ]; then
  TEST_FILES=$(find tests/${TYPE} -type f -name "test-*.js" -print0 | tr "\0" " " | sed '$s/.$//')
fi

WITH_RECTIFIER=${WITH_RECTIFIER} NODE_PATH=lib node_modules/whiskey/bin/whiskey \
  --tests "${TEST_FILES}" \
  --dependencies ${DEPENDENCIES_FILE} \
  --real-time \
  --report-timing \
  --failfast \
  --timeout ${TIMEOUT} \
  --sequential
