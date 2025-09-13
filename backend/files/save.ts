import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { FileItem } from "./types";
import { projects } from "~encore/clients";

interface SaveFileRequest {
  projectId: string;
  path: string;
  content: string;
  contentType?: string;
}

// Saves a file's content.
export const save = api<SaveFileRequest, FileItem>(
  { auth: true, expose: true, method: "PUT", path: "/files/:projectId/*path" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    const sizeBytes = Buffer.from(req.content, 'utf8').length;
    const contentType = req.contentType || getContentType(req.path);

    const file = await filesDB.queryRow<FileItem>`
      INSERT INTO project_files (project_id, path, content, content_type, size_bytes, is_directory)
      VALUES (${req.projectId}, ${req.path}, ${req.content}, ${contentType}, ${sizeBytes}, FALSE)
      ON CONFLICT (project_id, path) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        size_bytes = EXCLUDED.size_bytes,
        updated_at = NOW()
      RETURNING 
        id,
        project_id as "projectId",
        path,
        content,
        content_type as "contentType",
        size_bytes as "sizeBytes",
        is_directory as "isDirectory",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!file) {
      throw APIError.internal("failed to save file");
    }

    return file;
  }
);

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'text/typescript';
    case 'js': case 'jsx': return 'text/javascript';
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'json': return 'application/json';
    case 'md': return 'text/markdown';
    case 'py': return 'text/x-python';
    case 'java': return 'text/x-java';
    case 'go': return 'text/x-go';
    default: return 'text/plain';
  }
}
