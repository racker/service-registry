#!/bin/bash

FILES=$(find tests/conf example/ -type f -name "*.json")

for f in ${FILES}; do
    jsonlint -v ${f}
done
