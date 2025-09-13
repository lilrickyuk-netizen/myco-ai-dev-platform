export interface Project {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  templateName: string;
  userId: string;
  status: ProjectStatus;
  gitUrl?: string;
  deployUrl?: string;
  environmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 
  | 'creating' 
  | 'ready' 
  | 'building' 
  | 'deploying' 
  | 'deployed' 
  | 'error' 
  | 'archived';

export interface ProjectSetting {
  id: string;
  projectId: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId: string;
  role: CollaboratorRole;
  invitedAt: Date;
  joinedAt?: Date;
}

export type CollaboratorRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Template {
  type: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  tags: string[];
  framework: string;
  language: string;
  features: string[];
}