import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { filesDB } from "../files/db";

export interface DeleteProjectParams {
  id: string;
}

export interface DeleteProjectResponse {
  success: boolean;
}

// Deletes a project and all associated files.
export const deleteProject = api<DeleteProjectParams, DeleteProjectResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    // Check if project exists and belongs to user
    const existing = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${id} AND user_id = ${auth.userID}
    `;

    if (!existing) {
      throw APIError.notFound("Project not found");
    }

    // Delete all files associated with the project
    await filesDB.exec`
      DELETE FROM file_versions 
      WHERE file_id IN (
        SELECT id FROM files WHERE project_id = ${id}
      )
    `;
    
    await filesDB.exec`
      DELETE FROM files WHERE project_id = ${id}
    `;

    // Delete project settings
    await projectsDB.exec`
      DELETE FROM project_settings WHERE project_id = ${id}
    `;

    // Delete project collaborators
    await projectsDB.exec`
      DELETE FROM project_collaborators WHERE project_id = ${id}
    `;

    // Delete the project
    await projectsDB.exec`
      DELETE FROM projects 
      WHERE id = ${id} AND user_id = ${auth.userID}
    `;

    return { success: true };
  }
);