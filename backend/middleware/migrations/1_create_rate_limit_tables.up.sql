CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_entries_key ON rate_limit_entries(key);
CREATE INDEX idx_rate_limit_entries_timestamp ON rate_limit_entries(timestamp);
CREATE INDEX idx_rate_limit_entries_key_timestamp ON rate_limit_entries(key, timestamp);

-- Composite index for efficient cleanup
CREATE INDEX idx_rate_limit_entries_cleanup ON rate_limit_entries(timestamp) WHERE timestamp < NOW() - INTERVAL '1 day';