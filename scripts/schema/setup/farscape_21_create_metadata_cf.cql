USE farscape;

-- KEY is account ID
-- metadata associated with an account is kept here so that accounts do not have to be updated frequently.
CREATE COLUMNFAMILY metadata (KEY ascii PRIMARY KEY)
WITH comparator = text
AND default_validation = text;
