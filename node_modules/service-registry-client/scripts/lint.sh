#!/bin/bash

./node_modules/.bin/jshint $(find ./lib ./examples -type f -name "*.js") --config jshint.json
