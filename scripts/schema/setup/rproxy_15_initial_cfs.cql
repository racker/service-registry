USE rproxy;

CREATE COLUMNFAMILY main (
  KEY ascii PRIMARY KEY
);

CREATE COLUMNFAMILY counters (
  KEY ascii PRIMARY KEY
) WITH default_validation = counter;
