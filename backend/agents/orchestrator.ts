import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { agentsDB } from "./db";
import { 
  AgentSession, 
  AgentTask, 
  AgentSessionStatus, 
  AgentTaskStatus,
  OrchestrationRequest,
  OrchestrationResponse 
} from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface CreateSessionRequest {
  projectId: string;
  type: string;
  request: Record<string, any>;
}

export interface UpdateSessionRequest {
  sessionId: string;
  status?: AgentSessionStatus;
  progress?: Record<string, any>;
  response?: Record<string, any>;
  errorMessage?: string;
}

export interface CreateTaskRequest {
  sessionId: string;
  agentName: string;
  taskType: string;
  input: Record<string, any>;
  dependencies?: string[];
}

export interface UpdateTaskRequest {
  taskId: string;
  status?: AgentTaskStatus;
  output?: Record<string, any>;
  progress?: number;
  errorMessage?: string;
}

export const createSession = api<CreateSessionRequest, { sessionId: string }>(
  { auth: true, expose: true, method: "POST", path: "/agents/sessions" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.type) {
      throw APIError.invalidArgument("Project ID and type are required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow`
      SELECT id FROM projects WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;
    
    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    const session = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO agent_sessions (project_id, user_id, type, status, request, progress)
      VALUES (${req.projectId}, ${auth.userID}, ${req.type}, 'pending', ${JSON.stringify(req.request)}, '{}')
      RETURNING id
    `;

    if (!session) {
      throw APIError.internal("Failed to create session");
    }

    return { sessionId: session.id };
  }
);

export const updateSession = api<UpdateSessionRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/agents/sessions/:sessionId" },
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

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.status);
    }

    if (req.progress) {
      updates.push(`progress = $${paramIndex++}`);
      values.push(JSON.stringify(req.progress));
    }

    if (req.response) {
      updates.push(`response = $${paramIndex++}`);
      values.push(JSON.stringify(req.response));
    }

    if (req.errorMessage) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(req.errorMessage);
    }

    if (req.status === 'completed' || req.status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      throw APIError.invalidArgument("No valid fields to update");
    }

    values.push(req.sessionId);
    const query = `
      UPDATE agent_sessions 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await agentsDB.exec(query, ...values);
    return { success: true };
  }
);

export const getSession = api<{ sessionId: string }, AgentSession | null>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions/:sessionId" },
  async (req) => {
    const auth = getAuthData()!;

    const session = await agentsDB.queryRow<{
      id: string;
      project_id: string;
      user_id: string;
      type: string;
      status: AgentSessionStatus;
      request: string;
      response: string | null;
      progress: string;
      error_message: string | null;
      started_at: Date;
      completed_at: Date | null;
      updated_at: Date;
    }>`
      SELECT 
        id, project_id, user_id, type, status, request, response, 
        progress, error_message, started_at, completed_at, updated_at
      FROM agent_sessions 
      WHERE id = ${req.sessionId} AND user_id = ${auth.userID}
    `;

    if (!session) {
      return null;
    }

    // Get tasks for this session
    const tasks = await agentsDB.query<{
      id: string;
      agent_name: string;
      task_type: string;
      status: AgentTaskStatus;
      input: string;
      output: string | null;
      progress: number;
      error_message: string | null;
      started_at: Date | null;
      completed_at: Date | null;
      created_at: Date;
    }>`
      SELECT 
        id, agent_name, task_type, status, input, output, 
        progress, error_message, started_at, completed_at, created_at
      FROM agent_tasks 
      WHERE session_id = ${session.id}
      ORDER BY created_at ASC
    `;

    return {
      id: session.id,
      projectId: session.project_id,
      userId: session.user_id,
      status: session.status,
      agents: [], // TODO: Implement actual agent loading
      tasks: tasks.map(task => ({
        id: task.id,
        agentType: task.agent_name,
        taskType: task.task_type,
        description: task.task_type,
        status: task.status,
        progressPercentage: task.progress,
        startedAt: task.started_at,
        completedAt: task.completed_at
      })),
      startedAt: session.started_at,
      completedAt: session.completed_at,
      configuration: JSON.parse(session.request),
      results: session.response ? JSON.parse(session.response) : undefined
    };
  }
);

export const createTask = api<CreateTaskRequest, { taskId: string }>(
  { auth: true, expose: true, method: "POST", path: "/agents/tasks" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.sessionId || !req.agentName || !req.taskType) {
      throw APIError.invalidArgument("Session ID, agent name, and task type are required");
    }

    // Verify session ownership
    const session = await agentsDB.queryRow`
      SELECT id FROM agent_sessions 
      WHERE id = ${req.sessionId} AND user_id = ${auth.userID}
    `;
    
    if (!session) {
      throw APIError.notFound("Session not found or access denied");
    }

    const task = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO agent_tasks (session_id, agent_name, task_type, input, dependencies)
      VALUES (
        ${req.sessionId}, 
        ${req.agentName}, 
        ${req.taskType}, 
        ${JSON.stringify(req.input)},
        ${req.dependencies || []}
      )
      RETURNING id
    `;

    if (!task) {
      throw APIError.internal("Failed to create task");
    }

    return { taskId: task.id };
  }
);

export const updateTask = api<UpdateTaskRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/agents/tasks/:taskId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.taskId) {
      throw APIError.invalidArgument("Task ID is required");
    }

    // Verify task ownership through session
    const task = await agentsDB.queryRow`
      SELECT t.id 
      FROM agent_tasks t
      JOIN agent_sessions s ON t.session_id = s.id
      WHERE t.id = ${req.taskId} AND s.user_id = ${auth.userID}
    `;
    
    if (!task) {
      throw APIError.notFound("Task not found or access denied");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.status);
      
      if (req.status === 'running' || req.status === 'in_progress') {
        updates.push(`started_at = COALESCE(started_at, NOW())`);
      } else if (req.status === 'completed' || req.status === 'failed') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (req.output) {
      updates.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(req.output));
    }

    if (req.progress !== undefined) {
      updates.push(`progress = $${paramIndex++}`);
      values.push(req.progress);
    }

    if (req.errorMessage) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(req.errorMessage);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No valid fields to update");
    }

    values.push(req.taskId);
    const query = `
      UPDATE agent_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await agentsDB.exec(query, ...values);
    return { success: true };
  }
);

export const listSessions = api<{ projectId?: string }, AgentSession[]>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions" },
  async (req) => {
    const auth = getAuthData()!;

    let query = `
      SELECT 
        id, project_id, user_id, type, status, request, response, 
        progress, error_message, started_at, completed_at, updated_at
      FROM agent_sessions 
      WHERE user_id = $1
    `;
    const params: any[] = [auth.userID];

    if (req.projectId) {
      query += ` AND project_id = $2`;
      params.push(req.projectId);
    }

    query += ` ORDER BY started_at DESC`;

    const sessions = await agentsDB.query<{
      id: string;
      project_id: string;
      user_id: string;
      type: string;
      status: AgentSessionStatus;
      request: string;
      response: string | null;
      progress: string;
      error_message: string | null;
      started_at: Date;
      completed_at: Date | null;
      updated_at: Date;
    }>(query, ...params);

    return sessions.map(session => ({
      id: session.id,
      projectId: session.project_id,
      userId: session.user_id,
      status: session.status,
      agents: [],
      tasks: [],
      startedAt: session.started_at,
      completedAt: session.completed_at,
      configuration: JSON.parse(session.request),
      results: session.response ? JSON.parse(session.response) : undefined
    }));
  }
);