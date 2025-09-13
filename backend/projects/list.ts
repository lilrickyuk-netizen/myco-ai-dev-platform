import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

export interface ListProjectsResponse {
  projects: Project[];
}

// Lists all projects for the authenticated user.
export const list = api<void, ListProjectsResponse>(
  { auth: true, expose: true, method: "GET", path: "/projects" },
  async () => {
    const auth = getAuthData()!;

    const projects: Project[] = [];
    
    for await (const row of projectsDB.query<Project>`
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
      WHERE user_id = ${auth.userID}
      ORDER BY updated_at DESC
    `) {
      projects.push(row);
    }

    return { projects };
  }
);