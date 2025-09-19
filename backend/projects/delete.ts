import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "./db";

export interface DeleteProjectRequest {
  projectId: string;
  confirm?: boolean;
}

export interface ArchiveProjectRequest {
  projectId: string;
}

export const deleteProject = api<DeleteProjectRequest, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:projectId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow<{ 
      id: string; 
      name: string; 
      status: string;
    }>`
      SELECT id, name, status FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    // Safety check: require confirmation for non-creating projects
    if (project.status !== 'creating' && !req.confirm) {
      throw APIError.invalidArgument(
        "Deleting a deployed project requires confirmation. Set 'confirm' to true."
      );
    }

    // Check for active orchestrations
    const activeOrchestration = await projectsDB.queryRow`
      SELECT id FROM orchestrations 
      WHERE project_id = ${req.projectId} 
      AND status IN ('initializing', 'planning', 'architecture', 'development', 'integration', 'testing', 'security', 'deployment', 'verification')
    `;

    if (activeOrchestration) {
      throw APIError.failedPrecondition(
        "Cannot delete project with active orchestrations. Please cancel them first."
      );
    }

    // Start transaction to delete all related data
    try {
      // Delete project files (metadata only, actual files handled by MinIO cleanup)
      await projectsDB.exec`
        DELETE FROM file_versions 
        WHERE file_id IN (
          SELECT id FROM files WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM files WHERE project_id = ${req.projectId}
      `;

      // Delete agent-related data
      await projectsDB.exec`
        DELETE FROM agent_artifacts 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_logs 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_task_results 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_tasks 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_sessions WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM orchestrations WHERE project_id = ${req.projectId}
      `;

      // Delete project-specific data
      await projectsDB.exec`
        DELETE FROM project_settings WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM project_collaborators WHERE project_id = ${req.projectId}
      `;

      // Finally delete the project itself
      const result = await projectsDB.exec`
        DELETE FROM projects WHERE id = ${req.projectId}
      `;

      if (result.rowCount === 0) {
        throw APIError.internal("Failed to delete project");
      }

      return { success: true };

    } catch (error) {
      // If it's already an APIError, re-throw it
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("Failed to delete project: " + (error as Error).message);
    }
  }
);

export const archiveProject = api<ArchiveProjectRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/projects/:projectId/archive" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow<{ 
      id: string; 
      status: string;
    }>`
      SELECT id, status FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    if (project.status === 'archived') {
      throw APIError.invalidArgument("Project is already archived");
    }

    // Check for active orchestrations
    const activeOrchestration = await projectsDB.queryRow`
      SELECT id FROM orchestrations 
      WHERE project_id = ${req.projectId} 
      AND status IN ('initializing', 'planning', 'architecture', 'development', 'integration', 'testing', 'security', 'deployment', 'verification')
    `;

    if (activeOrchestration) {
      throw APIError.failedPrecondition(
        "Cannot archive project with active orchestrations. Please cancel them first."
      );
    }

    // Update project status to archived
    const result = await projectsDB.exec`
      UPDATE projects 
      SET 
        status = 'archived',
        updated_at = NOW()
      WHERE id = ${req.projectId}
    `;

    if (result.rowCount === 0) {
      throw APIError.internal("Failed to archive project");
    }

    return { success: true };
  }
);

export const restoreProject = api<{ projectId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/projects/:projectId/restore" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership and archived status
    const project = await projectsDB.queryRow<{ 
      id: string; 
      status: string;
    }>`
      SELECT id, status FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    if (project.status !== 'archived') {
      throw APIError.invalidArgument("Only archived projects can be restored");
    }

    // Restore project to ready status
    const result = await projectsDB.exec`
      UPDATE projects 
      SET 
        status = 'ready',
        updated_at = NOW()
      WHERE id = ${req.projectId}
    `;

    if (result.rowCount === 0) {
      throw APIError.internal("Failed to restore project");
    }

    return { success: true };
  }
);

export const forceDelete = api<{ projectId: string; adminKey: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:projectId/force" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.adminKey) {
      throw APIError.invalidArgument("Project ID and admin key are required");
    }

    // This is a dangerous operation - verify admin key (in production, use proper admin authentication)
    const expectedAdminKey = process.env.ADMIN_DELETE_KEY;
    if (!expectedAdminKey || req.adminKey !== expectedAdminKey) {
      throw APIError.permissionDenied("Invalid admin key");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow<{ 
      id: string; 
      name: string;
    }>`
      SELECT id, name FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    // Force delete without safety checks - clean up everything
    try {
      // Cancel any active orchestrations first
      await projectsDB.exec`
        UPDATE orchestrations 
        SET 
          status = 'cancelled',
          status_message = 'Project force deleted',
          updated_at = NOW()
        WHERE project_id = ${req.projectId}
        AND status IN ('initializing', 'planning', 'architecture', 'development', 'integration', 'testing', 'security', 'deployment', 'verification')
      `;

      await projectsDB.exec`
        UPDATE agent_sessions 
        SET 
          status = 'cancelled',
          completed_at = NOW(),
          updated_at = NOW()
        WHERE project_id = ${req.projectId}
        AND status = 'running'
      `;

      await projectsDB.exec`
        UPDATE agent_tasks 
        SET 
          status = 'cancelled',
          completed_at = NOW()
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
        AND status IN ('pending', 'running', 'in_progress')
      `;

      // Delete all data (same as regular delete)
      await projectsDB.exec`
        DELETE FROM file_versions 
        WHERE file_id IN (
          SELECT id FROM files WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM files WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM agent_artifacts 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_logs 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_task_results 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_tasks 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE project_id = ${req.projectId}
        )
      `;

      await projectsDB.exec`
        DELETE FROM agent_sessions WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM orchestrations WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM project_settings WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM project_collaborators WHERE project_id = ${req.projectId}
      `;

      await projectsDB.exec`
        DELETE FROM projects WHERE id = ${req.projectId}
      `;

      return { success: true };

    } catch (error) {
      throw APIError.internal("Failed to force delete project: " + (error as Error).message);
    }
  }
);