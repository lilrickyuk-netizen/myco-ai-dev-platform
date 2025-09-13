export interface File {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content?: string;
  mimeType?: string;
  sizeBytes: number;
  isDirectory: boolean;
  parentId?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  content: string;
  versionNumber: number;
  userId: string;
  commitMessage?: string;
  createdAt: Date;
}

export interface FileTree {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTree[];
  content?: string;
  mimeType?: string;
  sizeBytes: number;
  updatedAt: Date;
}

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