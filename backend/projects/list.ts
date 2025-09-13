import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

export interface ListProjectsResponse {
  projects: Project[];
}

// Lists all projects for the current user.
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
        template,
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt",
        settings,
        status
      FROM projects 
      WHERE user_id = ${auth.userID} OR id IN (
        SELECT project_id FROM project_collaborators 
        WHERE user_id = ${auth.userID} AND accepted_at IS NOT NULL
      )
      ORDER BY updated_at DESC
    `) {
      projects.push(row);
    }

    return { projects };
  }
);
