CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  path VARCHAR(1000) NOT NULL,
  content TEXT,
  content_type VARCHAR(100) DEFAULT 'text/plain',
  size_bytes INTEGER DEFAULT 0,
  is_directory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, path)
);

CREATE INDEX idx_files_project_id ON project_files(project_id);
CREATE INDEX idx_files_path ON project_files(project_id, path);
CREATE INDEX idx_files_directory ON project_files(project_id, is_directory);
