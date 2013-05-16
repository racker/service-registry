USE farscape;

-- KEY is account ID
CREATE COLUMNFAMILY accounting (KEY ascii PRIMARY KEY)
WITH default_validation = counter;
