-- Create deployment environments table
CREATE TABLE deployment_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('development', 'staging', 'production')),
  project_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('aws', 'gcp', 'azure', 'vercel', 'netlify', 'digitalocean', 'heroku')),
  region VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'deploying', 'failed')),
  config JSONB NOT NULL DEFAULT '{}',
  domain_name VARCHAR(255),
  subdomain VARCHAR(255),
  custom_domain VARCHAR(255),
  ssl_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, name)
);

-- Create indexes for deployment environments
CREATE INDEX idx_deployment_environments_project_id ON deployment_environments (project_id);
CREATE INDEX idx_deployment_environments_status ON deployment_environments (status);
CREATE INDEX idx_deployment_environments_provider ON deployment_environments (provider);

-- Create deployment history table
CREATE TABLE deployment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES deployment_environments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  version VARCHAR(100) NOT NULL,
  commit_hash VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'success', 'failed', 'rolled_back')),
  logs JSONB NOT NULL DEFAULT '[]',
  build_time INTEGER,
  deploy_time INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  deployed_by UUID NOT NULL,
  rollback_target UUID
);

-- Create indexes for deployment history
CREATE INDEX idx_deployment_history_environment_id ON deployment_history (environment_id);
CREATE INDEX idx_deployment_history_project_id ON deployment_history (project_id);
CREATE INDEX idx_deployment_history_status ON deployment_history (status);
CREATE INDEX idx_deployment_history_started_at ON deployment_history (started_at);

-- Create environment metrics table
CREATE TABLE environment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES deployment_environments(id) ON DELETE CASCADE,
  cpu DECIMAL(5,2) NOT NULL DEFAULT 0,
  memory DECIMAL(5,2) NOT NULL DEFAULT 0,
  storage DECIMAL(10,2) NOT NULL DEFAULT 0,
  bandwidth DECIMAL(15,2) NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  uptime DECIMAL(5,2) NOT NULL DEFAULT 100,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for environment metrics
CREATE INDEX idx_environment_metrics_environment_id ON environment_metrics (environment_id);
CREATE INDEX idx_environment_metrics_timestamp ON environment_metrics (timestamp);

-- Create updated_at trigger for environments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deployment_environments_updated_at 
    BEFORE UPDATE ON deployment_environments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();