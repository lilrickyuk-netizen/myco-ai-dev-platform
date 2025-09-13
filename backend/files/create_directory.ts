import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { FileItem } from "./types";
import { projects } from "~encore/clients";

interface CreateDirectoryRequest {
  projectId: string;
  path: string;
}

// Creates a new directory.
export const createDirectory = api<CreateDirectoryRequest, FileItem>(
  { auth: true, expose: true, method: "POST", path: "/files/:projectId/directories" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    const directory = await filesDB.queryRow<FileItem>`
      INSERT INTO project_files (project_id, path, is_directory)
      VALUES (${req.projectId}, ${req.path}, TRUE)
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

    if (!directory) {
      throw APIError.internal("failed to create directory");
    }

    return directory;
  }
);
