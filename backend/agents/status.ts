import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { projectsDB } from "../projects/db";
import { OrchestrationStatus } from "./types";

export interface GetStatusParams {
  orchestrationId: string;
}

// Gets the current status of a project orchestration.
export const getStatus = api<GetStatusParams, OrchestrationStatus>(
  { auth: true, expose: true, method: "GET", path: "/agents/status/:orchestrationId" },
  async ({ orchestrationId }) => {
    const auth = getAuthData()!;

    const orchestration = await agentsDB.queryRow<OrchestrationStatus>`
      SELECT 
        o.id as "orchestrationId",
        o.project_id as "projectId",
        o.status,
        o.status_message as "statusMessage",
        o.progress_percentage as "progressPercentage",
        o.current_phase as "currentPhase",
        o.estimated_completion as "estimatedCompletion",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        p.name as "projectName"
      FROM orchestrations o
      JOIN projects p ON o.project_id = p.id
      WHERE o.id = ${orchestrationId} AND o.user_id = ${auth.userID}
    `;

    if (!orchestration) {
      throw APIError.notFound("Orchestration not found");
    }

    // Get active tasks
    const tasks = [];
    for await (const task of agentsDB.query`
      SELECT 
        id,
        agent_type as "agentType",
        task_type as "taskType", 
        description,
        status,
        progress_percentage as "progressPercentage",
        started_at as "startedAt",
        completed_at as "completedAt"
      FROM agent_tasks
      WHERE orchestration_id = ${orchestrationId}
      ORDER BY created_at DESC
    `) {
      tasks.push(task);
    }

    return {
      ...orchestration,
      activeTasks: tasks,
    };
  }
);

export interface ListOrchestrationParams {
  projectId: string;
}

export interface ListOrchestrationsResponse {
  orchestrations: OrchestrationStatus[];
}

// Lists all orchestrations for a project.
export const listOrchestrations = api<ListOrchestrationParams, ListOrchestrationsResponse>(
  { auth: true, expose: true, method: "GET", path: "/agents/orchestrations/:projectId" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    const orchestrations = [];
    for await (const row of agentsDB.query<OrchestrationStatus>`
      SELECT 
        o.id as "orchestrationId",
        o.project_id as "projectId",
        o.status,
        o.status_message as "statusMessage",
        o.progress_percentage as "progressPercentage", 
        o.current_phase as "currentPhase",
        o.estimated_completion as "estimatedCompletion",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        p.name as "projectName"
      FROM orchestrations o
      JOIN projects p ON o.project_id = p.id
      WHERE o.project_id = ${projectId} AND o.user_id = ${auth.userID}
      ORDER BY o.created_at DESC
    `) {
      orchestrations.push(row);
    }

    return { orchestrations };
  }
);