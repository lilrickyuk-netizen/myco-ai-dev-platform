import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { projectsDB } from "../projects/db";
import { AgentSession, AgentTask, Agent, ProjectGenerationRequest } from "./types";

export interface CreateSessionRequest {
  projectId: string;
  type: string;
  request: Record<string, any>;
}

export interface GetSessionParams {
  id: string;
}

export interface ListSessionsParams {
  projectId: string;
}

export interface ListSessionsResponse {
  sessions: AgentSession[];
}

export interface GetTasksParams {
  sessionId: string;
}

export interface GetTasksResponse {
  tasks: AgentTask[];
}

export interface ListAgentsResponse {
  agents: Agent[];
}

// Creates a new agent session.
export const createSession = api<CreateSessionRequest, AgentSession>(
  { auth: true, expose: true, method: "POST", path: "/agents/sessions" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    // Create the session
    const session = await agentsDB.queryRow<AgentSession>`
      INSERT INTO agent_sessions (project_id, user_id, type, request, status, progress)
      VALUES (
        ${req.projectId}, 
        ${auth.userID}, 
        ${req.type}, 
        ${JSON.stringify(req.request)}, 
        'pending',
        ${JSON.stringify({ totalTasks: 0, completedTasks: 0, percentage: 0 })}
      )
      RETURNING 
        id,
        project_id as "projectId",
        user_id as "userId",
        type,
        status,
        request,
        response,
        progress,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        updated_at as "updatedAt"
    `;

    if (!session) {
      throw APIError.internal("Failed to create session");
    }

    // Start orchestration process
    startOrchestration(session.id, req.type, req.request);

    return {
      ...session,
      request: typeof session.request === 'string' ? JSON.parse(session.request) : session.request,
      progress: typeof session.progress === 'string' ? JSON.parse(session.progress) : session.progress,
    };
  }
);

// Gets a specific session by ID.
export const getSession = api<GetSessionParams, AgentSession>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const session = await agentsDB.queryRow<AgentSession>`
      SELECT 
        id,
        project_id as "projectId",
        user_id as "userId",
        type,
        status,
        request,
        response,
        progress,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        updated_at as "updatedAt"
      FROM agent_sessions 
      WHERE id = ${id}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${session.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    return {
      ...session,
      request: typeof session.request === 'string' ? JSON.parse(session.request) : session.request,
      response: session.response ? (typeof session.response === 'string' ? JSON.parse(session.response) : session.response) : undefined,
      progress: typeof session.progress === 'string' ? JSON.parse(session.progress) : session.progress,
    };
  }
);

// Lists all sessions for a project.
export const listSessions = api<ListSessionsParams, ListSessionsResponse>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions/project/:projectId" },
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

    const sessions: AgentSession[] = [];
    
    for await (const row of agentsDB.query<AgentSession>`
      SELECT 
        id,
        project_id as "projectId",
        user_id as "userId",
        type,
        status,
        request,
        response,
        progress,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        updated_at as "updatedAt"
      FROM agent_sessions 
      WHERE project_id = ${projectId}
      ORDER BY started_at DESC
    `) {
      sessions.push({
        ...row,
        request: typeof row.request === 'string' ? JSON.parse(row.request) : row.request,
        response: row.response ? (typeof row.response === 'string' ? JSON.parse(row.response) : row.response) : undefined,
        progress: typeof row.progress === 'string' ? JSON.parse(row.progress) : row.progress,
      });
    }

    return { sessions };
  }
);

// Gets tasks for a session.
export const getTasks = api<GetTasksParams, GetTasksResponse>(
  { auth: true, expose: true, method: "GET", path: "/agents/sessions/:sessionId/tasks" },
  async ({ sessionId }) => {
    const auth = getAuthData()!;

    // Verify session exists and user has access
    const session = await agentsDB.queryRow`
      SELECT project_id FROM agent_sessions WHERE id = ${sessionId}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${session.project_id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    const tasks: AgentTask[] = [];
    
    for await (const row of agentsDB.query<AgentTask>`
      SELECT 
        id,
        session_id as "sessionId",
        agent_name as "agentName",
        task_type as "taskType",
        status,
        input,
        output,
        dependencies,
        progress,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        created_at as "createdAt"
      FROM agent_tasks 
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `) {
      tasks.push({
        ...row,
        input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
        output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      });
    }

    return { tasks };
  }
);

// Lists available agents.
export const listAgents = api<void, ListAgentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/agents/list" },
  async () => {
    const agents: Agent[] = [
      {
        name: "orchestrator",
        displayName: "Orchestrator Agent",
        description: "Master coordinator for project generation and task management",
        capabilities: ["task_planning", "resource_allocation", "progress_monitoring"],
        supportedTaskTypes: ["orchestrate", "plan", "coordinate"],
        dependencies: [],
        estimatedDuration: 30
      },
      {
        name: "planner",
        displayName: "Planner Agent",
        description: "Requirements analysis and task planning specialist",
        capabilities: ["requirements_analysis", "task_breakdown", "timeline_estimation"],
        supportedTaskTypes: ["analyze_requirements", "create_plan", "estimate_effort"],
        dependencies: [],
        estimatedDuration: 120
      },
      {
        name: "architect",
        displayName: "Architecture Agent",
        description: "System design and architecture decision specialist",
        capabilities: ["system_design", "architecture_patterns", "technology_selection"],
        supportedTaskTypes: ["design_architecture", "select_technologies", "create_adr"],
        dependencies: ["planner"],
        estimatedDuration: 180
      },
      {
        name: "backend",
        displayName: "Backend Agent",
        description: "Complete backend code generation specialist",
        capabilities: ["api_development", "database_design", "service_architecture"],
        supportedTaskTypes: ["generate_api", "design_database", "implement_services"],
        dependencies: ["architect"],
        estimatedDuration: 300
      },
      {
        name: "frontend",
        displayName: "Frontend Agent",
        description: "Full frontend application generation specialist",
        capabilities: ["ui_development", "component_design", "state_management"],
        supportedTaskTypes: ["generate_ui", "create_components", "implement_features"],
        dependencies: ["architect", "backend"],
        estimatedDuration: 240
      },
      {
        name: "infrastructure",
        displayName: "Infrastructure Agent",
        description: "DevOps, IaC, Kubernetes, and deployment specialist",
        capabilities: ["containerization", "orchestration", "ci_cd", "monitoring"],
        supportedTaskTypes: ["create_dockerfile", "setup_kubernetes", "configure_ci_cd"],
        dependencies: ["backend", "frontend"],
        estimatedDuration: 180
      },
      {
        name: "security",
        displayName: "Security Agent",
        description: "Vulnerability scanning, hardening, and compliance specialist",
        capabilities: ["vulnerability_scanning", "security_hardening", "compliance_checks"],
        supportedTaskTypes: ["scan_vulnerabilities", "apply_security", "check_compliance"],
        dependencies: ["backend", "frontend", "infrastructure"],
        estimatedDuration: 150
      },
      {
        name: "verifier",
        displayName: "Verifier Agent",
        description: "Quality assurance and completeness checking specialist",
        capabilities: ["code_review", "completeness_check", "quality_metrics"],
        supportedTaskTypes: ["review_code", "check_completeness", "generate_metrics"],
        dependencies: ["backend", "frontend", "security"],
        estimatedDuration: 120
      },
      {
        name: "deployer",
        displayName: "Deployer Agent",
        description: "Multi-cloud deployment automation specialist",
        capabilities: ["cloud_deployment", "environment_setup", "health_monitoring"],
        supportedTaskTypes: ["deploy_application", "setup_environment", "monitor_health"],
        dependencies: ["verifier"],
        estimatedDuration: 180
      },
      {
        name: "documenter",
        displayName: "Documenter Agent",
        description: "API docs, tutorials, and README generation specialist",
        capabilities: ["api_documentation", "tutorial_creation", "readme_generation"],
        supportedTaskTypes: ["generate_api_docs", "create_tutorials", "write_readme"],
        dependencies: ["backend", "frontend"],
        estimatedDuration: 90
      }
    ];

    return { agents };
  }
);

// Helper function to start orchestration process
async function startOrchestration(sessionId: string, type: string, request: Record<string, any>) {
  // Update session status to running
  await agentsDB.exec`
    UPDATE agent_sessions 
    SET status = 'running', updated_at = NOW()
    WHERE id = ${sessionId}
  `;

  // Create tasks based on session type
  const tasks = createTasksForSessionType(type, request);
  
  // Create task records
  for (const task of tasks) {
    await agentsDB.exec`
      INSERT INTO agent_tasks (session_id, agent_name, task_type, input, dependencies)
      VALUES (${sessionId}, ${task.agentName}, ${task.taskType}, ${JSON.stringify(task.input)}, ${task.dependencies})
    `;
  }

  // Update progress
  await updateSessionProgress(sessionId, tasks.length, 0);

  // Start executing tasks (this would be implemented with actual agent coordination)
  executeTasksPipeline(sessionId, tasks);
}

function createTasksForSessionType(type: string, request: Record<string, any>) {
  if (type === 'project_generation') {
    return [
      { agentName: 'planner', taskType: 'analyze_requirements', input: request, dependencies: [] },
      { agentName: 'architect', taskType: 'design_architecture', input: request, dependencies: ['planner'] },
      { agentName: 'backend', taskType: 'generate_api', input: request, dependencies: ['architect'] },
      { agentName: 'frontend', taskType: 'generate_ui', input: request, dependencies: ['architect'] },
      { agentName: 'infrastructure', taskType: 'setup_kubernetes', input: request, dependencies: ['backend', 'frontend'] },
      { agentName: 'security', taskType: 'scan_vulnerabilities', input: request, dependencies: ['backend', 'frontend'] },
      { agentName: 'verifier', taskType: 'check_completeness', input: request, dependencies: ['backend', 'frontend', 'security'] },
      { agentName: 'deployer', taskType: 'deploy_application', input: request, dependencies: ['verifier'] },
      { agentName: 'documenter', taskType: 'generate_api_docs', input: request, dependencies: ['backend', 'frontend'] },
    ];
  }
  
  return [];
}

async function updateSessionProgress(sessionId: string, total: number, completed: number) {
  const progress = {
    totalTasks: total,
    completedTasks: completed,
    percentage: Math.round((completed / total) * 100),
  };

  await agentsDB.exec`
    UPDATE agent_sessions 
    SET progress = ${JSON.stringify(progress)}, updated_at = NOW()
    WHERE id = ${sessionId}
  `;
}

// Mock implementation of task execution pipeline
async function executeTasksPipeline(sessionId: string, tasks: any[]) {
  // Real implementation of agent coordination logic
  try {
    for (const task of tasks) {
      await updateSessionProgress(sessionId, tasks.length, tasks.indexOf(task));
      
      // Call AI engine to execute the task
      const response = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/agents/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        },
        body: JSON.stringify({
          sessionId,
          task,
          agentType: task.agentName
        })
      });
      
      if (!response.ok) {
        throw new Error(`Agent execution failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Store task result
      await agentsDB.exec`
        INSERT INTO agent_task_results (session_id, task_name, result, created_at)
        VALUES (${sessionId}, ${task.agentName}, ${JSON.stringify(result)}, NOW())
      `;
    }
    
    // Mark session as completed
    await agentsDB.exec`
      UPDATE agent_sessions 
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = ${sessionId}
    `;
    
  } catch (error) {
    console.error('Task pipeline execution failed:', error);
    
    // Mark session as failed
    await agentsDB.exec`
      UPDATE agent_sessions 
      SET status = 'failed', error_message = ${error.message}, completed_at = NOW(), updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  }
}