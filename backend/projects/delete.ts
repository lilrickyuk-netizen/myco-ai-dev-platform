import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";

interface DeleteProjectRequest {
  id: string;
}

// Deletes a project.
export const deleteProject = api<DeleteProjectRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:id" },
  async (req) => {
    const auth = getAuthData()!;
    
    const result = await projectsDB.queryRow<{ count: number }>`
      DELETE FROM projects 
      WHERE id = ${req.id} AND user_id = ${auth.userID}
      RETURNING 1 as count
    `;

    if (!result) {
      throw APIError.notFound("project not found or access denied");
    }
  }
);
