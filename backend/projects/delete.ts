import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";

export interface DeleteProjectParams {
  id: string;
}

// Deletes a project.
export const deleteProject = api<DeleteProjectParams, void>(
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

    // Delete the project (cascades to related tables)
    await projectsDB.exec`
      DELETE FROM projects 
      WHERE id = ${id} AND user_id = ${auth.userID}
    `;
  }
);