-- Create execution environments table
CREATE TABLE execution_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  runtime VARCHAR(50) NOT NULL CHECK (runtime IN ('node', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet')),
  version VARCHAR(50) NOT NULL DEFAULT 'latest',
  image VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'running', 'stopped', 'failed', 'terminated')),
  project_id UUID NOT NULL,
  container_id VARCHAR(255),
  ports JSONB NOT NULL DEFAULT '{}',
  environment JSONB NOT NULL DEFAULT '{}',
  resources JSONB NOT NULL DEFAULT '{"cpu": 1, "memory": 512, "storage": 1024}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for execution environments
CREATE INDEX idx_execution_environments_project_id ON execution_environments (project_id);
CREATE INDEX idx_execution_environments_status ON execution_environments (status);
CREATE INDEX idx_execution_environments_runtime ON execution_environments (runtime);

-- Create execution results table
CREATE TABLE execution_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES execution_environments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  command TEXT NOT NULL,
  exit_code INTEGER NOT NULL,
  stdout TEXT,
  stderr TEXT,
  duration INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for execution results
CREATE INDEX idx_execution_results_environment_id ON execution_results (environment_id);
CREATE INDEX idx_execution_results_project_id ON execution_results (project_id);
CREATE INDEX idx_execution_results_started_at ON execution_results (started_at);

-- Create terminal sessions table
CREATE TABLE terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES execution_environments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for terminal sessions
CREATE INDEX idx_terminal_sessions_environment_id ON terminal_sessions (environment_id);
CREATE INDEX idx_terminal_sessions_project_id ON terminal_sessions (project_id);
CREATE INDEX idx_terminal_sessions_status ON terminal_sessions (status);

-- Create terminal messages table
CREATE TABLE terminal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES terminal_sessions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('input', 'output', 'error', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for terminal messages
CREATE INDEX idx_terminal_messages_session_id ON terminal_messages (session_id);
CREATE INDEX idx_terminal_messages_timestamp ON terminal_messages (timestamp);

-- Create package operations table
CREATE TABLE package_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  environment_id UUID NOT NULL REFERENCES execution_environments(id) ON DELETE CASCADE,
  manager VARCHAR(50) NOT NULL CHECK (manager IN ('npm', 'yarn', 'pnpm', 'pip', 'poetry', 'maven', 'gradle', 'cargo', 'composer', 'gem')),
  operation VARCHAR(50) NOT NULL CHECK (operation IN ('install', 'uninstall', 'update', 'list', 'audit')),
  packages JSONB,
  options JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for package operations
CREATE INDEX idx_package_operations_project_id ON package_operations (project_id);
CREATE INDEX idx_package_operations_environment_id ON package_operations (environment_id);
CREATE INDEX idx_package_operations_status ON package_operations (status);