import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { 
  OrchestrationStatus, 
  AgentTaskStatus,
  AgentTask 
} from "./types";

export interface GetStatusRequest {
  orchestrationId: string;
}

export interface ListStatusRequest {
  projectId?: string;
  status?: AgentTaskStatus;
  limit?: number;
  offset?: number;
}

export interface StatusSummary {
  total: number;
  byStatus: Record<AgentTaskStatus, number>;
  activeOrchestrations: number;
  recentFailures: number;
}

export const getOrchestrationStatus = api<GetStatusRequest, OrchestrationStatus | null>(
  { auth: true, expose: true, method: "GET", path: "/agents/status/:orchestrationId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.orchestrationId) {
      throw APIError.invalidArgument("Orchestration ID is required");
    }

    const orchestration = await agentsDB.queryRow<{
      id: string;
      project_id: string;
      project_name: string | null;
      status: AgentTaskStatus;
      status_message: string | null;
      progress_percentage: number;
      current_phase: string | null;
      estimated_completion: Date | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT 
        o.id,
        o.project_id,
        p.name as project_name,
        o.status,
        o.status_message,
        o.progress_percentage,
        o.current_phase,
        o.estimated_completion,
        o.created_at,
        o.updated_at
      FROM orchestrations o
      LEFT JOIN projects p ON o.project_id = p.id
      WHERE o.id = ${req.orchestrationId} AND o.user_id = ${auth.userID}
    `;

    if (!orchestration) {
      return null;
    }

    // Get active tasks for this orchestration
    const tasks = await agentsDB.query<{
      id: string;
      agent_name: string;
      task_type: string;
      status: AgentTaskStatus;
      progress: number;
      started_at: Date | null;
      completed_at: Date | null;
    }>`
      SELECT 
        t.id,
        t.agent_name,
        t.task_type,
        t.status,
        t.progress,
        t.started_at,
        t.completed_at
      FROM agent_tasks t
      JOIN agent_sessions s ON t.session_id = s.id
      JOIN orchestrations o ON s.project_id = o.project_id
      WHERE o.id = ${orchestration.id}
      ORDER BY t.created_at ASC
    `;

    return {
      orchestrationId: orchestration.id,
      projectId: orchestration.project_id,
      projectName: orchestration.project_name,
      status: orchestration.status,
      statusMessage: orchestration.status_message,
      progressPercentage: orchestration.progress_percentage,
      currentPhase: orchestration.current_phase,
      estimatedCompletion: orchestration.estimated_completion,
      createdAt: orchestration.created_at,
      updatedAt: orchestration.updated_at,
      activeTasks: tasks.map(task => ({
        id: task.id,
        agentType: task.agent_name,
        taskType: task.task_type,
        description: task.task_type,
        status: task.status,
        progressPercentage: task.progress,
        startedAt: task.started_at,
        completedAt: task.completed_at
      }))
    };
  }
);

export const listOrchestrationStatus = api<ListStatusRequest, OrchestrationStatus[]>(
  { auth: true, expose: true, method: "GET", path: "/agents/status" },
  async (req) => {
    const auth = getAuthData()!;

    let query = `
      SELECT 
        o.id,
        o.project_id,
        p.name as project_name,
        o.status,
        o.status_message,
        o.progress_percentage,
        o.current_phase,
        o.estimated_completion,
        o.created_at,
        o.updated_at
      FROM orchestrations o
      LEFT JOIN projects p ON o.project_id = p.id
      WHERE o.user_id = $1
    `;
    const params: any[] = [auth.userID];
    let paramIndex = 2;

    if (req.projectId) {
      query += ` AND o.project_id = $${paramIndex++}`;
      params.push(req.projectId);
    }

    if (req.status) {
      query += ` AND o.status = $${paramIndex++}`;
      params.push(req.status);
    }

    query += ` ORDER BY o.created_at DESC`;

    if (req.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(req.limit);
    }

    if (req.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(req.offset);
    }

    const orchestrations = await agentsDB.query<{
      id: string;
      project_id: string;
      project_name: string | null;
      status: AgentTaskStatus;
      status_message: string | null;
      progress_percentage: number;
      current_phase: string | null;
      estimated_completion: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(query, ...params);

    return orchestrations.map(orchestration => ({
      orchestrationId: orchestration.id,
      projectId: orchestration.project_id,
      projectName: orchestration.project_name,
      status: orchestration.status,
      statusMessage: orchestration.status_message,
      progressPercentage: orchestration.progress_percentage,
      currentPhase: orchestration.current_phase,
      estimatedCompletion: orchestration.estimated_completion,
      createdAt: orchestration.created_at,
      updatedAt: orchestration.updated_at,
      activeTasks: [] // Tasks loaded separately to avoid N+1 queries
    }));
  }
);

export const getStatusSummary = api<{ projectId?: string }, StatusSummary>(
  { auth: true, expose: true, method: "GET", path: "/agents/status/summary" },
  async (req) => {
    const auth = getAuthData()!;

    let projectFilter = "";
    const params: any[] = [auth.userID];
    
    if (req.projectId) {
      projectFilter = " AND o.project_id = $2";
      params.push(req.projectId);
    }

    // Get total orchestrations and counts by status
    const statusCounts = await agentsDB.query<{
      status: AgentTaskStatus;
      count: number;
    }>`
      SELECT status, COUNT(*) as count
      FROM orchestrations o
      WHERE o.user_id = $1 ${projectFilter}
      GROUP BY status
    `;

    // Get active orchestrations count
    const activeCount = await agentsDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM orchestrations o
      WHERE o.user_id = $1 ${projectFilter}
      AND o.status IN ('initializing', 'planning', 'architecture', 'development', 'integration', 'testing', 'security', 'deployment', 'verification')
    `;

    // Get recent failures (last 24 hours)
    const recentFailures = await agentsDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM orchestrations o
      WHERE o.user_id = $1 ${projectFilter}
      AND o.status = 'failed'
      AND o.updated_at > NOW() - INTERVAL '24 hours'
    `;

    const byStatus: Record<AgentTaskStatus, number> = {
      'initializing': 0,
      'planning': 0,
      'architecture': 0,
      'development': 0,
      'integration': 0,
      'testing': 0,
      'security': 0,
      'deployment': 0,
      'verification': 0,
      'completed': 0,
      'failed': 0,
      'cancelled': 0
    };

    let total = 0;
    statusCounts.forEach(row => {
      byStatus[row.status] = row.count;
      total += row.count;
    });

    return {
      total,
      byStatus,
      activeOrchestrations: activeCount?.count || 0,
      recentFailures: recentFailures?.count || 0
    };
  }
);

export const getTaskLogs = api<{ taskId: string }, Array<{
  id: string;
  level: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}>>(
  { auth: true, expose: true, method: "GET", path: "/agents/tasks/:taskId/logs" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.taskId) {
      throw APIError.invalidArgument("Task ID is required");
    }

    // Verify task ownership
    const task = await agentsDB.queryRow`
      SELECT t.id 
      FROM agent_tasks t
      JOIN agent_sessions s ON t.session_id = s.id
      WHERE t.id = ${req.taskId} AND s.user_id = ${auth.userID}
    `;
    
    if (!task) {
      throw APIError.notFound("Task not found or access denied");
    }

    const logs = await agentsDB.query<{
      id: string;
      level: string;
      message: string;
      metadata: string;
      timestamp: Date;
    }>`
      SELECT id, level, message, metadata, timestamp
      FROM agent_logs
      WHERE task_id = ${req.taskId}
      ORDER BY timestamp ASC
    `;

    return logs.map(log => ({
      id: log.id,
      level: log.level,
      message: log.message,
      metadata: JSON.parse(log.metadata),
      timestamp: log.timestamp
    }));
  }
);

export const getSessionLogs = api<{ sessionId: string }, Array<{
  id: string;
  level: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}>>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions/:sessionId/logs" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.sessionId) {
      throw APIError.invalidArgument("Session ID is required");
    }

    // Verify session ownership
    const session = await agentsDB.queryRow`
      SELECT id FROM agent_sessions 
      WHERE id = ${req.sessionId} AND user_id = ${auth.userID}
    `;
    
    if (!session) {
      throw APIError.notFound("Session not found or access denied");
    }

    const logs = await agentsDB.query<{
      id: string;
      level: string;
      message: string;
      metadata: string;
      timestamp: Date;
    }>`
      SELECT id, level, message, metadata, timestamp
      FROM agent_logs
      WHERE session_id = ${req.sessionId}
      ORDER BY timestamp ASC
    `;

    return logs.map(log => ({
      id: log.id,
      level: log.level,
      message: log.message,
      metadata: JSON.parse(log.metadata),
      timestamp: log.timestamp
    }));
  }
);