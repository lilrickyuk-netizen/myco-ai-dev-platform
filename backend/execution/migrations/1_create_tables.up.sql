CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE execution_environments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  container_id TEXT,
  port INTEGER,
  cpu_limit TEXT DEFAULT '1',
  memory_limit TEXT DEFAULT '512Mi',
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE execution_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment_id UUID NOT NULL REFERENCES execution_environments(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  output TEXT,
  error_output TEXT,
  user_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'stdout'
);

CREATE INDEX idx_execution_environments_project_id ON execution_environments(project_id);
CREATE INDEX idx_execution_environments_user_id ON execution_environments(user_id);
CREATE INDEX idx_execution_environments_status ON execution_environments(status);
CREATE INDEX idx_execution_sessions_environment_id ON execution_sessions(environment_id);
CREATE INDEX idx_execution_sessions_user_id ON execution_sessions(user_id);
CREATE INDEX idx_execution_sessions_status ON execution_sessions(status);
CREATE INDEX idx_execution_logs_session_id ON execution_logs(session_id);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp);