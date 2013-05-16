CREATE KEYSPACE rproxy with strategy_class = SimpleStrategy and strategy_options:replication_factor=1;

USE rproxy;

CREATE COLUMNFAMILY main (
  KEY ascii PRIMARY KEY
);

CREATE COLUMNFAMILY counters (
  KEY ascii PRIMARY KEY
) WITH default_validation = counter;
