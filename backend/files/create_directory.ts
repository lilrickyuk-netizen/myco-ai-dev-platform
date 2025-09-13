import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";
import { File } from "./types";

export interface CreateDirectoryRequest {
  projectId: string;
  path: string;
  name: string;
  parentId?: string;
}

// Creates a new directory.
export const createDirectory = api<CreateDirectoryRequest, File>(
  { auth: true, expose: true, method: "POST", path: "/files/directory" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    // Check if directory already exists
    const existing = await filesDB.queryRow`
      SELECT id FROM files 
      WHERE project_id = ${req.projectId} AND path = ${req.path}
    `;

    if (existing) {
      throw APIError.alreadyExists("Directory already exists");
    }

    // Verify parent exists if specified
    if (req.parentId) {
      const parent = await filesDB.queryRow`
        SELECT id, is_directory FROM files 
        WHERE id = ${req.parentId} AND project_id = ${req.projectId}
      `;

      if (!parent) {
        throw APIError.notFound("Parent directory not found");
      }

      if (!parent.is_directory) {
        throw APIError.invalidArgument("Parent must be a directory");
      }
    }

    // Create the directory
    const directory = await filesDB.queryRow<File>`
      INSERT INTO files (project_id, name, path, is_directory, parent_id, user_id, size_bytes)
      VALUES (${req.projectId}, ${req.name}, ${req.path}, TRUE, ${req.parentId || null}, ${auth.userID}, 0)
      RETURNING 
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
    `;

    if (!directory) {
      throw APIError.internal("Failed to create directory");
    }

    return directory;
  }
);