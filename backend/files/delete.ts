import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";

export interface DeleteFileParams {
  id: string;
}

export interface DeleteFileResponse {
  success: boolean;
}

// Deletes a file or directory.
export const deleteFile = api<DeleteFileParams, DeleteFileResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/files/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    // Get file info and verify access
    const file = await filesDB.queryRow`
      SELECT f.id, f.project_id, f.is_directory
      FROM files f
      JOIN projects p ON f.project_id = p.id
      WHERE f.id = ${id} AND p.user_id = ${auth.userID}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // If it's a directory, delete all children recursively
    if (file.is_directory) {
      // Delete all child files and their versions
      await filesDB.exec`
        DELETE FROM file_versions 
        WHERE file_id IN (
          SELECT id FROM files 
          WHERE parent_id = ${id} OR path LIKE (
            SELECT path || '%' FROM files WHERE id = ${id}
          )
        )
      `;
      
      await filesDB.exec`
        DELETE FROM files 
        WHERE parent_id = ${id} OR path LIKE (
          SELECT path || '%' FROM files WHERE id = ${id}
        )
      `;
    } else {
      // Delete file versions first
      await filesDB.exec`
        DELETE FROM file_versions WHERE file_id = ${id}
      `;
    }

    // Delete the file itself
    await filesDB.exec`
      DELETE FROM files WHERE id = ${id}
    `;

    return { success: true };
  }
);