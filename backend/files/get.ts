import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";
import { File } from "./types";

export interface GetFileParams {
  id: string;
}

// Gets a specific file by ID.
export const get = api<GetFileParams, File>(
  { auth: true, expose: true, method: "GET", path: "/files/file/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const file = await filesDB.queryRow<File>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        path,
        content,
        mime_type as "mimeType",
        size_bytes as "sizeBytes",
        is_directory as "isDirectory",
        parent_id as "parentId",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM files 
      WHERE id = ${id}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${file.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    return file;
  }
);