USE farscape;

-- 30 hours
-- Enough so that the repair cronjob doesn't need to run more often then every
-- 24 hours
ALTER COLUMNFAMILY heartbeat_markers WITH gc_grace_seconds=108000;

-- 2 days
ALTER COLUMNFAMILY services WITH gc_grace_seconds=172800;
