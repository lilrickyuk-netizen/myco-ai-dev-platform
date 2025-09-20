export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  content?: string;
  children?: FileNode[];
  size?: number;
  lastModified?: Date;
  isReadonly?: boolean;
}

export interface CreateFileRequest {
  projectId: string;
  path: string;
  content?: string;
  type: "file" | "directory";
}

export interface UpdateFileRequest {
  content: string;
}

// Legacy alias for test compatibility
export interface WriteFileRequest extends UpdateFileRequest {}

export interface CreateDirectoryRequest {
  projectId: string;
  path: string;
}

export interface FileListResponse {
  files: FileNode[];
}