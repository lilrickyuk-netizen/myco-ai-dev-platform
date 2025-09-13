import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project, ProjectStatus } from "./types";

export interface UpdateProjectRequest {
  id: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  gitUrl?: string;
  deployUrl?: string;
  environmentId?: string;
}

// Updates a project.
export const update = api<UpdateProjectRequest, Project>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:id" },
  async (req) => {
    const auth = getAuthData()!;

    // Check if project exists and belongs to user
    const existing = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.id} AND user_id = ${auth.userID}
    `;

    if (!existing) {
      throw APIError.notFound("Project not found");
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(req.name);
    }

    if (req.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(req.description);
    }

    if (req.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }

    if (req.gitUrl !== undefined) {
      updates.push(`git_url = $${paramIndex++}`);
      params.push(req.gitUrl);
    }

    if (req.deployUrl !== undefined) {
      updates.push(`deploy_url = $${paramIndex++}`);
      params.push(req.deployUrl);
    }

    if (req.environmentId !== undefined) {
      updates.push(`environment_id = $${paramIndex++}`);
      params.push(req.environmentId);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.id);

    const query = `
      UPDATE projects 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
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

    const project = await projectsDB.rawQueryRow<Project>(query, ...params);

    if (!project) {
      throw APIError.internal("Failed to update project");
    }

    return project;
  }
);