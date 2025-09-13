import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

export interface GetProjectParams {
  id: string;
}

// Gets a specific project by ID.
export const get = api<GetProjectParams, Project>(
  { auth: true, expose: true, method: "GET", path: "/projects/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const project = await projectsDB.queryRow<Project>`
      SELECT 
        id,
        name,
        description,
        template_type as "templateType",
        template_name as "templateName",
        user_id as "userId",
        status,
        git_url as "gitUrl",
        deploy_url as "deployUrl",
        environment_id as "environmentId", 
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM projects 
      WHERE id = ${id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    return project;
  }
);