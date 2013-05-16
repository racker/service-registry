#!/bin/bash

sleep 2
cqlsh localhost 9160 < ./scripts/setup.cql
sleep 2
echo "Done"
