CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE deployment_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL,
  config_schema JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES deployment_providers(id),
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL DEFAULT '{}',
  build_logs TEXT,
  deploy_logs TEXT,
  url TEXT,
  last_deployed_at TIMESTAMPTZ,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name, environment)
);

CREATE TABLE deployment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  commit_sha TEXT,
  build_logs TEXT,
  deploy_logs TEXT,
  url TEXT,
  deployed_by TEXT NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rollback_to UUID REFERENCES deployment_history(id)
);

-- Insert default providers
INSERT INTO deployment_providers (name, display_name, type, config_schema) VALUES
('vercel', 'Vercel', 'static', '{"apiKey": {"type": "string", "required": true}, "teamId": {"type": "string", "required": false}}'),
('netlify', 'Netlify', 'static', '{"apiKey": {"type": "string", "required": true}, "siteId": {"type": "string", "required": false}}'),
('aws-s3', 'AWS S3', 'static', '{"accessKeyId": {"type": "string", "required": true}, "secretAccessKey": {"type": "string", "required": true}, "bucketName": {"type": "string", "required": true}, "region": {"type": "string", "required": true}}'),
('heroku', 'Heroku', 'container', '{"apiKey": {"type": "string", "required": true}, "appName": {"type": "string", "required": false}}'),
('railway', 'Railway', 'container', '{"apiKey": {"type": "string", "required": true}, "projectId": {"type": "string", "required": false}}'),
('render', 'Render', 'container', '{"apiKey": {"type": "string", "required": true}, "serviceId": {"type": "string", "required": false}}');

CREATE INDEX idx_deployments_project_id ON deployments(project_id);
CREATE INDEX idx_deployments_provider_id ON deployments(provider_id);
CREATE INDEX idx_deployments_user_id ON deployments(user_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployment_history_deployment_id ON deployment_history(deployment_id);
CREATE INDEX idx_deployment_history_deployed_at ON deployment_history(deployed_at);