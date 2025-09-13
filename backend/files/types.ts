export interface FileItem {
  id: string;
  projectId: string;
  path: string;
  content?: string;
  contentType: string;
  sizeBytes: number;
  isDirectory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  size?: number;
}
