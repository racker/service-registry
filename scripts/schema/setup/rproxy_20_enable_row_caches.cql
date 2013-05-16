USE rproxy;

ALTER COLUMNFAMILY main WITH caching='keys_only';
ALTER COLUMNFAMILY counters WITH caching='keys_only';
