if [ ! $DB_BACKEND ]; then
  DB_BACKEND="redis"
fi

if [ $TRAVIS ]; then
  config="tests/dependencies-travis-${DB_BACKEND}.json"
else
  config="tests/dependencies-${DB_BACKEND}.json"
fi

if [ ! $TEST_FILES ]; then
  TEST_FILES=$(find tests/ -type f -name "test-*.js" -print0 | tr "\0" " " | sed '$s/.$//')
fi

NODE_PATH=lib node_modules/whiskey/bin/whiskey \
  --tests "${TEST_FILES}" \
  --dependencies ${config} --real-time --sequential
