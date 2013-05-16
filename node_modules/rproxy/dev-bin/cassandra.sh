#!/bin/bash

basedir=`dirname $0`

if [ ! $CASSANDRA_CONF ]; then
    export CASSANDRA_CONF=$basedir/../tests/conf/cass-1.1
fi

if [ ! $CASSANDRA_HOME ]; then
    CASSANDRA_HOME="/opt/cassandra"
fi


rm -rf /tmp/cass/*
exec $CASSANDRA_HOME/bin/cassandra -f
