#!/bin/bash

ulimit -n 10000

# Invalid token
ab -n 20000 -c 200 http://127.0.0.1:9000/bar

# Valid token
ab -n 20000 -c 200 -H "X-Auth-Token: dev" -H "X-Tenant-Id: 7777" http://127.0.0.1:9000/bar
ab -n 20000 -c 200 -H "X-Auth-Token: dev" -H "X-Tenant-Id: 7777" http://127.0.0.1:9000/test/bar
