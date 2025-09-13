import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";

export interface DeleteFileParams {
  id: string;
}

// Deletes a file or directory.
export const deleteFile = api<DeleteFileParams, void>(
  { auth: true, expose: true, method: "DELETE", path: "/files/file/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    // Get file info and verify ownership
    const file = await filesDB.queryRow`
      SELECT project_id, is_directory FROM files WHERE id = ${id}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${file.project_id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    // If it's a directory, check if it has children
    if (file.is_directory) {
      const children = await filesDB.queryRow`
        SELECT COUNT(*) as count FROM files WHERE parent_id = ${id}
      `;

      if (children && children.count > 0) {
        throw APIError.failedPrecondition("Directory must be empty before deletion");
      }
    }

    // Delete the file (versions will be cascade deleted)
    await filesDB.exec`DELETE FROM files WHERE id = ${id}`;
  }
);