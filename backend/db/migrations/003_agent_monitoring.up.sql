-- Agent monitoring tables

CREATE TYPE agent_type AS ENUM ('planner', 'backend', 'frontend', 'architecture', 'validation', 'orchestrator');
CREATE TYPE agent_status AS ENUM ('pending', 'running', 'completed', 'failed', 'paused');
CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'paused');

-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  status workflow_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  estimated_completion_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  current_phase VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workflow phases table
CREATE TABLE workflow_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status agent_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  estimated_duration INTEGER NOT NULL, -- in seconds
  actual_duration INTEGER, -- in seconds
  phase_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES workflow_phases(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  type agent_type NOT NULL,
  status agent_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion_time TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  outputs JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Agent dependencies table
CREATE TABLE agent_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  depends_on_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, depends_on_agent_id)
);

-- Agent progress updates table for detailed tracking
CREATE TABLE agent_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  status agent_status NOT NULL,
  message TEXT,
  estimated_completion_time TIMESTAMP WITH TIME ZONE,
  outputs JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workflows_project_id ON workflows(project_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflow_phases_workflow_id ON workflow_phases(workflow_id);
CREATE INDEX idx_workflow_phases_order ON workflow_phases(workflow_id, phase_order);
CREATE INDEX idx_agents_workflow_id ON agents(workflow_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agent_dependencies_agent_id ON agent_dependencies(agent_id);
CREATE INDEX idx_agent_dependencies_depends_on ON agent_dependencies(depends_on_agent_id);
CREATE INDEX idx_progress_updates_workflow_id ON agent_progress_updates(workflow_id);
CREATE INDEX idx_progress_updates_agent_id ON agent_progress_updates(agent_id);
CREATE INDEX idx_progress_updates_created_at ON agent_progress_updates(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_phases_updated_at
  BEFORE UPDATE ON workflow_phases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();