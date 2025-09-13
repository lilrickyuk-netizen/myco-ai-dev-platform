import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  templateType: string;
  templateName: string;
}

// Creates a new project.
export const create = api<CreateProjectRequest, Project>(
  { auth: true, expose: true, method: "POST", path: "/projects" },
  async (req) => {
    const auth = getAuthData()!;

    // Validate project name
    if (!req.name.trim()) {
      throw APIError.invalidArgument("Project name cannot be empty");
    }

    // Check if project name already exists for this user
    const existing = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE user_id = ${auth.userID} AND name = ${req.name}
    `;
    
    if (existing) {
      throw APIError.alreadyExists("Project with this name already exists");
    }

    // Create the project
    const project = await projectsDB.queryRow<Project>`
      INSERT INTO projects (name, description, template_type, template_name, user_id, status)
      VALUES (${req.name}, ${req.description || null}, ${req.templateType}, ${req.templateName}, ${auth.userID}, 'creating')
      RETURNING 
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
    `;

    if (!project) {
      throw APIError.internal("Failed to create project");
    }

    return project;
  }
);