CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  is_directory BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id UUID REFERENCES files(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, path)
);

CREATE TABLE file_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  commit_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(file_id, version_number)
);

CREATE INDEX idx_files_project_id ON files(project_id);
CREATE INDEX idx_files_parent_id ON files(parent_id);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX idx_file_versions_user_id ON file_versions(user_id);