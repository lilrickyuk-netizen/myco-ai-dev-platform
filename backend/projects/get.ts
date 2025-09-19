import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project } from "./types";

export interface GetProjectRequest {
  projectId: string;
}

export interface ListProjectsRequest {
  status?: string;
  templateType?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export const get = api<GetProjectRequest, Project | null>(
  { auth: true, expose: true, method: "GET", path: "/projects/:projectId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    const project = await projectsDB.queryRow<{
      id: string;
      name: string;
      description: string | null;
      template_type: string;
      template_name: string;
      user_id: string;
      status: string;
      git_url: string | null;
      deploy_url: string | null;
      environment_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT 
        id,
        name,
        description,
        template_type,
        template_name,
        user_id,
        status,
        git_url,
        deploy_url,
        environment_id,
        created_at,
        updated_at
      FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      templateType: project.template_type,
      templateName: project.template_name,
      userId: project.user_id,
      status: project.status as any,
      gitUrl: project.git_url,
      deployUrl: project.deploy_url,
      environmentId: project.environment_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    };
  }
);

export const list = api<ListProjectsRequest, {
  projects: Project[];
  total: number;
  hasMore: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/projects" },
  async (req) => {
    const auth = getAuthData()!;

    const limit = Math.min(req.limit || 50, 100);
    const offset = req.offset || 0;

    let whereConditions = ["user_id = $1"];
    const params: any[] = [auth.userID];
    let paramIndex = 2;

    if (req.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }

    if (req.templateType) {
      whereConditions.push(`template_type = $${paramIndex++}`);
      params.push(req.templateType);
    }

    if (req.search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${req.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM projects 
      WHERE ${whereClause}
    `;
    const countResult = await projectsDB.queryRow<{ count: number }>(countQuery, ...params);
    const total = countResult?.count || 0;

    // Get projects with pagination
    const projectsQuery = `
      SELECT 
        id,
        name,
        description,
        template_type,
        template_name,
        user_id,
        status,
        git_url,
        deploy_url,
        environment_id,
        created_at,
        updated_at
      FROM projects 
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const projects = await projectsDB.query<{
      id: string;
      name: string;
      description: string | null;
      template_type: string;
      template_name: string;
      user_id: string;
      status: string;
      git_url: string | null;
      deploy_url: string | null;
      environment_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(projectsQuery, ...params);

    return {
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        templateType: project.template_type,
        templateName: project.template_name,
        userId: project.user_id,
        status: project.status as any,
        gitUrl: project.git_url,
        deployUrl: project.deploy_url,
        environmentId: project.environment_id,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      })),
      total,
      hasMore: offset + projects.length < total
    };
  }
);

export const getByCollaborator = api<{ userId: string }, Project[]>(
  { auth: true, expose: true, method: "GET", path: "/projects/collaborator/:userId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.userId) {
      throw APIError.invalidArgument("User ID is required");
    }

    // Users can only see projects they own or collaborate on
    const projects = await projectsDB.query<{
      id: string;
      name: string;
      description: string | null;
      template_type: string;
      template_name: string;
      user_id: string;
      status: string;
      git_url: string | null;
      deploy_url: string | null;
      environment_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT DISTINCT
        p.id,
        p.name,
        p.description,
        p.template_type,
        p.template_name,
        p.user_id,
        p.status,
        p.git_url,
        p.deploy_url,
        p.environment_id,
        p.created_at,
        p.updated_at
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
      AND (
        p.user_id = ${req.userId}
        OR (pc.user_id = ${req.userId} AND pc.joined_at IS NOT NULL)
      )
      ORDER BY p.updated_at DESC
    `;

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      templateType: project.template_type,
      templateName: project.template_name,
      userId: project.user_id,
      status: project.status as any,
      gitUrl: project.git_url,
      deployUrl: project.deploy_url,
      environmentId: project.environment_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    }));
  }
);

export const getSettings = api<{ projectId: string }, Array<{
  id: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}>>(
  { auth: true, expose: true, method: "GET", path: "/projects/:projectId/settings" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership or collaboration
    const project = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    const settings = await projectsDB.query<{
      id: string;
      key: string;
      value: string;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, key, value, created_at, updated_at
      FROM project_settings
      WHERE project_id = ${req.projectId}
      ORDER BY key
    `;

    return settings.map(setting => ({
      id: setting.id,
      key: setting.key,
      value: JSON.parse(setting.value),
      createdAt: setting.created_at,
      updatedAt: setting.updated_at
    }));
  }
);

export const getCollaborators = api<{ projectId: string }, Array<{
  id: string;
  userId: string;
  role: string;
  invitedAt: Date;
  joinedAt: Date | null;
}>>(
  { auth: true, expose: true, method: "GET", path: "/projects/:projectId/collaborators" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership or collaboration
    const project = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    const collaborators = await projectsDB.query<{
      id: string;
      user_id: string;
      role: string;
      invited_at: Date;
      joined_at: Date | null;
    }>`
      SELECT id, user_id, role, invited_at, joined_at
      FROM project_collaborators
      WHERE project_id = ${req.projectId}
      ORDER BY invited_at DESC
    `;

    return collaborators.map(collab => ({
      id: collab.id,
      userId: collab.user_id,
      role: collab.role,
      invitedAt: collab.invited_at,
      joinedAt: collab.joined_at
    }));
  }
);