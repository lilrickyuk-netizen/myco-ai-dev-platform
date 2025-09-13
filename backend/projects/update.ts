import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

interface UpdateProjectRequest {
  id: string;
  name?: string;
  description?: string;
  settings?: Record<string, any>;
}

// Updates a project.
export const update = api<UpdateProjectRequest, Project>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:id" },
  async (req) => {
    const auth = getAuthData()!;
    
    const project = await projectsDB.queryRow<Project>`
      UPDATE projects 
      SET 
        name = COALESCE(${req.name}, name),
        description = COALESCE(${req.description}, description),
        settings = COALESCE(${req.settings ? JSON.stringify(req.settings) : null}, settings),
        updated_at = NOW()
      WHERE id = ${req.id} AND user_id = ${auth.userID}
      RETURNING 
        id,
        name,
        description,
        template,
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt",
        settings,
        status
    `;

    if (!project) {
      throw APIError.notFound("project not found or access denied");
    }

    return project;
  }
);
