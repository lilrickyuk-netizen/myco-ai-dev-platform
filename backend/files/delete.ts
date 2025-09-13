import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projects } from "~encore/clients";

interface DeleteFileRequest {
  projectId: string;
  path: string;
}

// Deletes a file or directory.
export const deleteFile = api<DeleteFileRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/files/:projectId/*path" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    // Delete the file/directory and all its children
    await filesDB.exec`
      DELETE FROM project_files 
      WHERE project_id = ${req.projectId} 
        AND (path = ${req.path} OR path LIKE ${req.path + '/%'})
    `;
  }
);
