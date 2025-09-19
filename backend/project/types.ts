export interface Project {
  id: string;
  name: string;
  description?: string;
  template?: string;
  templateType: string;
  templateName: string;
  status: "active" | "archived" | "deleted";
  visibility: "private" | "public";
  repositoryUrl?: string;
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template?: string;
  visibility?: "private" | "public";
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  deployUrl?: string;
  status?: "active" | "archived" | "deleted";
  visibility?: "private" | "public";
}