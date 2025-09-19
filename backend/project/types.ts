export interface Project {
  id: string;
  name: string;
  description?: string;
  template?: string;
  templateType: string;
  templateName: string;
  status: string;
  gitUrl?: string;
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  gitUrl?: string;
  deployUrl?: string;
  status?: string;
}