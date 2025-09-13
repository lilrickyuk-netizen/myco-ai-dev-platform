import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

interface GetProjectRequest {
  id: string;
}

// Gets a project by ID.
export const get = api<GetProjectRequest, Project>(
  { auth: true, expose: true, method: "GET", path: "/projects/:id" },
  async (req) => {
    const auth = getAuthData()!;
    
    const project = await projectsDB.queryRow<Project>`
      SELECT 
        id,
        name,
        description,
        template,
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt",
        settings,
        status
      FROM projects 
      WHERE id = ${req.id} AND (
        user_id = ${auth.userID} OR id IN (
          SELECT project_id FROM project_collaborators 
          WHERE user_id = ${auth.userID} AND accepted_at IS NOT NULL
        )
      )
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    return project;
  }
);
