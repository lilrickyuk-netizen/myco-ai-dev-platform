import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";
import { Project, ProjectStatus } from "./types";

export interface UpdateProjectRequest {
  projectId: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  gitUrl?: string;
  deployUrl?: string;
  environmentId?: string;
}

export interface UpdateProjectSettingRequest {
  projectId: string;
  key: string;
  value: any;
}

export interface InviteCollaboratorRequest {
  projectId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface UpdateCollaboratorRoleRequest {
  projectId: string;
  collaboratorId: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface JoinProjectRequest {
  projectId: string;
  inviteId: string;
}

export const update = api<UpdateProjectRequest, Project>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:projectId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership or admin collaboration
    const project = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.name !== undefined) {
      // Check if name is unique for this user
      if (req.name.trim() === '') {
        throw APIError.invalidArgument("Project name cannot be empty");
      }
      
      const existing = await projectsDB.queryRow`
        SELECT id FROM projects 
        WHERE user_id = ${auth.userID} AND name = ${req.name} AND id != ${req.projectId}
      `;
      
      if (existing) {
        throw APIError.alreadyExists("Project with this name already exists");
      }

      updates.push(`name = $${paramIndex++}`);
      values.push(req.name);
    }

    if (req.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(req.description || null);
    }

    if (req.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.status);
    }

    if (req.gitUrl !== undefined) {
      updates.push(`git_url = $${paramIndex++}`);
      values.push(req.gitUrl || null);
    }

    if (req.deployUrl !== undefined) {
      updates.push(`deploy_url = $${paramIndex++}`);
      values.push(req.deployUrl || null);
    }

    if (req.environmentId !== undefined) {
      updates.push(`environment_id = $${paramIndex++}`);
      values.push(req.environmentId || null);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No valid fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.projectId);

    const query = `
      UPDATE projects 
      SET ${updates.join(', ')}
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

    const updatedProject = await projectsDB.queryRow<Project>(query, ...values);

    if (!updatedProject) {
      throw APIError.internal("Failed to update project");
    }

    return updatedProject;
  }
);

export const updateSetting = api<UpdateProjectSettingRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:projectId/settings" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.key) {
      throw APIError.invalidArgument("Project ID and key are required");
    }

    // Verify project ownership or admin collaboration
    const project = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    // Upsert setting
    await projectsDB.exec`
      INSERT INTO project_settings (project_id, key, value, created_at, updated_at)
      VALUES (${req.projectId}, ${req.key}, ${JSON.stringify(req.value)}, NOW(), NOW())
      ON CONFLICT (project_id, key)
      DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
    `;

    return { success: true };
  }
);

export const inviteCollaborator = api<InviteCollaboratorRequest, { success: boolean; inviteId: string }>(
  { auth: true, expose: true, method: "POST", path: "/projects/:projectId/collaborators" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.userId || !req.role) {
      throw APIError.invalidArgument("Project ID, user ID, and role are required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    // Check if user is already a collaborator
    const existing = await projectsDB.queryRow`
      SELECT id FROM project_collaborators
      WHERE project_id = ${req.projectId} AND user_id = ${req.userId}
    `;

    if (existing) {
      throw APIError.alreadyExists("User is already a collaborator on this project");
    }

    // Create invitation
    const invite = await projectsDB.queryRow<{ id: string }>`
      INSERT INTO project_collaborators (project_id, user_id, role, invited_at)
      VALUES (${req.projectId}, ${req.userId}, ${req.role}, NOW())
      RETURNING id
    `;

    if (!invite) {
      throw APIError.internal("Failed to create invitation");
    }

    return { success: true, inviteId: invite.id };
  }
);

export const updateCollaboratorRole = api<UpdateCollaboratorRoleRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:projectId/collaborators/:collaboratorId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.collaboratorId || !req.role) {
      throw APIError.invalidArgument("Project ID, collaborator ID, and role are required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    // Update collaborator role
    const result = await projectsDB.exec`
      UPDATE project_collaborators 
      SET role = ${req.role}
      WHERE id = ${req.collaboratorId} AND project_id = ${req.projectId}
    `;

    if (result.rowCount === 0) {
      throw APIError.notFound("Collaborator not found");
    }

    return { success: true };
  }
);

export const joinProject = api<JoinProjectRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/projects/:projectId/join" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.inviteId) {
      throw APIError.invalidArgument("Project ID and invite ID are required");
    }

    // Verify invitation exists and user is the intended recipient
    const invitation = await projectsDB.queryRow`
      SELECT id, user_id, joined_at FROM project_collaborators
      WHERE id = ${req.inviteId} 
      AND project_id = ${req.projectId} 
      AND user_id = ${auth.userID}
    `;

    if (!invitation) {
      throw APIError.notFound("Invitation not found or not for this user");
    }

    if (invitation.joined_at) {
      throw APIError.alreadyExists("Invitation already accepted");
    }

    // Accept invitation
    await projectsDB.exec`
      UPDATE project_collaborators 
      SET joined_at = NOW()
      WHERE id = ${req.inviteId}
    `;

    return { success: true };
  }
);

export const removeCollaborator = api<{ projectId: string; collaboratorId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:projectId/collaborators/:collaboratorId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.collaboratorId) {
      throw APIError.invalidArgument("Project ID and collaborator ID are required");
    }

    // Verify project ownership or self-removal
    const collaboration = await projectsDB.queryRow<{ user_id: string; project_owner: string }>`
      SELECT 
        pc.user_id,
        p.user_id as project_owner
      FROM project_collaborators pc
      JOIN projects p ON pc.project_id = p.id
      WHERE pc.id = ${req.collaboratorId} AND pc.project_id = ${req.projectId}
    `;

    if (!collaboration) {
      throw APIError.notFound("Collaborator not found");
    }

    // Allow project owner to remove anyone, or users to remove themselves
    if (collaboration.project_owner !== auth.userID && collaboration.user_id !== auth.userID) {
      throw APIError.permissionDenied("Insufficient permissions to remove this collaborator");
    }

    // Remove collaborator
    await projectsDB.exec`
      DELETE FROM project_collaborators 
      WHERE id = ${req.collaboratorId} AND project_id = ${req.projectId}
    `;

    return { success: true };
  }
);

export const deleteSetting = api<{ projectId: string; key: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:projectId/settings/:key" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.key) {
      throw APIError.invalidArgument("Project ID and key are required");
    }

    // Verify project ownership or admin collaboration
    const project = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    const result = await projectsDB.exec`
      DELETE FROM project_settings 
      WHERE project_id = ${req.projectId} AND key = ${req.key}
    `;

    if (result.rowCount === 0) {
      throw APIError.notFound("Setting not found");
    }

    return { success: true };
  }
);