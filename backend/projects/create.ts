import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project, ProjectTemplate } from "./types";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template: ProjectTemplate;
  settings?: Record<string, any>;
}

// Creates a new project.
export const create = api<CreateProjectRequest, Project>(
  { auth: true, expose: true, method: "POST", path: "/projects" },
  async (req) => {
    const auth = getAuthData()!;
    
    if (!req.name.trim()) {
      throw APIError.invalidArgument("project name is required");
    }

    const project = await projectsDB.queryRow<Project>`
      INSERT INTO projects (name, description, template, user_id, settings)
      VALUES (${req.name}, ${req.description || null}, ${req.template}, ${auth.userID}, ${JSON.stringify(req.settings || {})})
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
      throw APIError.internal("failed to create project");
    }

    return project;
  }
);
