import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";
import { File } from "./types";

export interface SaveFileRequest {
  projectId: string;
  path: string;
  content: string;
  name?: string;
  mimeType?: string;
}

// Saves or updates a file.
export const save = api<SaveFileRequest, File>(
  { auth: true, expose: true, method: "POST", path: "/files/save" },
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

    const fileName = req.name || req.path.split('/').pop() || 'untitled';
    const sizeBytes = Buffer.byteLength(req.content, 'utf8');

    // Check if file already exists
    const existing = await filesDB.queryRow`
      SELECT id, content FROM files 
      WHERE project_id = ${req.projectId} AND path = ${req.path}
    `;

    let file: File;

    if (existing) {
      // Update existing file
      const updated = await filesDB.queryRow<File>`
        UPDATE files 
        SET 
          content = ${req.content},
          name = ${fileName},
          mime_type = ${req.mimeType || null},
          size_bytes = ${sizeBytes},
          updated_at = NOW()
        WHERE project_id = ${req.projectId} AND path = ${req.path}
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

      if (!updated) {
        throw APIError.internal("Failed to update file");
      }

      file = updated;

      // Save version if content changed
      if (existing.content !== req.content) {
        await saveFileVersion(existing.id, req.content, auth.userID);
      }
    } else {
      // Create new file
      const created = await filesDB.queryRow<File>`
        INSERT INTO files (project_id, name, path, content, mime_type, size_bytes, is_directory, user_id)
        VALUES (${req.projectId}, ${fileName}, ${req.path}, ${req.content}, ${req.mimeType || null}, ${sizeBytes}, FALSE, ${auth.userID})
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

      if (!created) {
        throw APIError.internal("Failed to create file");
      }

      file = created;
      await saveFileVersion(file.id, req.content, auth.userID);
    }

    return file;
  }
);

async function saveFileVersion(fileId: string, content: string, userId: string) {
  // Get the next version number
  const lastVersion = await filesDB.queryRow<{ versionNumber: number }>`
    SELECT version_number as "versionNumber" 
    FROM file_versions 
    WHERE file_id = ${fileId} 
    ORDER BY version_number DESC 
    LIMIT 1
  `;

  const nextVersion = (lastVersion?.versionNumber || 0) + 1;

  await filesDB.exec`
    INSERT INTO file_versions (file_id, content, version_number, user_id)
    VALUES (${fileId}, ${content}, ${nextVersion}, ${userId})
  `;
}