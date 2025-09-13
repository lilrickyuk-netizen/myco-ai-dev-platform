import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { FileItem } from "./types";
import { projects } from "~encore/clients";

interface GetFileRequest {
  projectId: string;
  path: string;
}

// Gets a file's content.
export const get = api<GetFileRequest, FileItem>(
  { auth: true, expose: true, method: "GET", path: "/files/:projectId/*path" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    const file = await filesDB.queryRow<FileItem>`
      SELECT 
        id,
        project_id as "projectId",
        path,
        content,
        content_type as "contentType",
        size_bytes as "sizeBytes",
        is_directory as "isDirectory",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM project_files 
      WHERE project_id = ${req.projectId} AND path = ${req.path}
    `;

    if (!file) {
      throw APIError.notFound("file not found");
    }

    return file;
  }
);
