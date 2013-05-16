USE farscape;

-- KEY is tenantId
CREATE COLUMNFAMILY accounts (
  KEY ascii PRIMARY KEY
);

-- KEY is tenantId
CREATE COLUMNFAMILY services (
  KEY ascii PRIMARY KEY
);

-- KEY is tenantId
CREATE COLUMNFAMILY configuration_values (
  KEY ascii PRIMARY KEY
);

-- KEY is tenantId
CREATE COLUMNFAMILY events (
  KEY ascii PRIMARY KEY
) WITH comparator=uuid;

-- KEY is tenantId
CREATE COLUMNFAMILY heartbeat_markers (
  KEY ascii PRIMARY KEY
) WITH comparator=uuid;

-- KEY is tenantId
CREATE COLUMNFAMILY last_service_heartbeats (
  KEY ascii PRIMARY KEY
);

CREATE COLUMNFAMILY tag_to_service_idx (
  KEY ascii PRIMARY KEY
);
