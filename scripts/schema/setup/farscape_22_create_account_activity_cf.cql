USE farscape;

-- KEY is shard
-- This CF keeps track of how recently an account received activity.
CREATE COLUMNFAMILY account_activity (KEY bigint PRIMARY KEY)
WITH comparator = text
AND default_validation = timestamp;
