USE rproxy;

-- 2 days
-- Note: This value should be larger than the maximum rate limiting bucket size
-- which is currently 1 day.
ALTER COLUMNFAMILY counters WITH gc_grace_seconds=172800;
