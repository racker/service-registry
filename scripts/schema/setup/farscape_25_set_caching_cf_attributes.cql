USE farscape;

ALTER COLUMNFAMILY accounts WITH caching='all' AND row_cache_provider='SerializingCacheProvider';

ALTER COLUMNFAMILY services WITH caching='keys_only';

ALTER COLUMNFAMILY configuration_values WITH caching='all' AND row_cache_provider='SerializingCacheProvider';

ALTER COLUMNFAMILY events WITH caching='all' AND row_cache_provider='SerializingCacheProvider';

ALTER COLUMNFAMILY tag_to_service_idx WITH caching='all' AND row_cache_provider='SerializingCacheProvider';

ALTER COLUMNFAMILY last_service_heartbeats WITH caching='keys_only';

-- Use ConcurrentLinkedHashCacheProvider provider, because it performs
-- better in update-heavy workloads and it updates cache in place
-- http://www.datastax.com/dev/blog/caching-in-cassandra-1-1
ALTER COLUMNFAMILY heartbeat_markers WITH caching='keys_only';

ALTER COLUMNFAMILY account_activity WITH caching='all' AND row_cache_provider='ConcurrentLinkedHashCacheProvider';

ALTER COLUMNFAMILY metadata WITH caching='all' AND row_cache_provider='ConcurrentLinkedHashCacheProvider';
