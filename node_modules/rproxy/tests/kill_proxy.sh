#!/bin/bash

for file in `ls pids/*`; do
  pid=`cat $file`
  kill -9 $pid
done

exit 0
