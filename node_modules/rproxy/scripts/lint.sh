#!/bin/bash

# Lint JavaScript files
./node_modules/.bin/jshint $(find ./lib ./tests ./misc -type f -name "*.js") --config jshint.json

if [ $? -ne 0 ]; then
  echo "Lint failed"
  exit 1
fi

# Check config files syntax
for file in tests/conf/*.json; do
  echo "Linting file: ${file}"
  cat $file | python -mjson.tool

  if [ $? -ne 0 ]; then
    echo "Lint failed: ${file}"
    exit 1
  fi
done

cat example/config.json | python -mjson.tool
exit $?
