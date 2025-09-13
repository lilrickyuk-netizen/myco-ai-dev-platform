import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { executionDB } from "./db";
import { projectsDB } from "../projects/db";
import { Environment, EnvironmentStatus, CreateEnvironmentRequest, ExecutionResult } from "./types";

// Creates a new execution environment for a project.
export const createEnvironment = api<CreateEnvironmentRequest, Environment>(
  { auth: true, expose: true, method: "POST", path: "/execution/environments" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project exists and belongs to user
    const project = await projectsDB.queryRow`
      SELECT id, name FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    const environment = await executionDB.queryRow<Environment>`
      INSERT INTO environments (project_id, name, type, configuration, status, user_id)
      VALUES (${req.projectId}, ${req.name}, ${req.type}, ${JSON.stringify(req.configuration)}, 'creating', ${auth.userID})
      RETURNING 
        id,
        project_id as "projectId",
        name,
        type,
        configuration,
        status,
        container_id as "containerId",
        port,
        url,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!environment) {
      throw APIError.internal("Failed to create environment");
    }

    // Start environment creation process
    startEnvironmentCreation(environment.id, req);

    return environment;
  }
);

export interface GetEnvironmentParams {
  id: string;
}

// Gets an execution environment by ID.
export const getEnvironment = api<GetEnvironmentParams, Environment>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const environment = await executionDB.queryRow<Environment>`
      SELECT 
        e.id,
        e.project_id as "projectId",
        e.name,
        e.type,
        e.configuration,
        e.status,
        e.container_id as "containerId",
        e.port,
        e.url,
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      WHERE e.id = ${id} AND p.user_id = ${auth.userID}
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found");
    }

    return environment;
  }
);

export interface ListEnvironmentsParams {
  projectId: string;
}

export interface ListEnvironmentsResponse {
  environments: Environment[];
}

// Lists all environments for a project.
export const listEnvironments = api<ListEnvironmentsParams, ListEnvironmentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/project/:projectId" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify project access
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    const environments = [];
    for await (const env of executionDB.query<Environment>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        type,
        configuration,
        status,
        container_id as "containerId",
        port,
        url,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM environments
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `) {
      environments.push(env);
    }

    return { environments };
  }
);

export interface ExecuteCodeRequest {
  environmentId: string;
  code: string;
  language: string;
  fileName?: string;
}

// Executes code in a sandboxed environment.
export const executeCode = api<ExecuteCodeRequest, ExecutionResult>(
  { auth: true, expose: true, method: "POST", path: "/execution/execute" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify environment access
    const environment = await executionDB.queryRow`
      SELECT e.id, e.container_id, e.status
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      WHERE e.id = ${req.environmentId} AND p.user_id = ${auth.userID}
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found");
    }

    if (environment.status !== 'running') {
      throw APIError.invalidArgument("Environment is not running");
    }

    // Execute code in the container
    const result = await executeInContainer(environment.containerId, req.code, req.language, req.fileName);

    // Log execution
    await executionDB.exec`
      INSERT INTO executions (environment_id, code, language, output, exit_code, executed_at)
      VALUES (${req.environmentId}, ${req.code}, ${req.language}, ${result.output}, ${result.exitCode}, NOW())
    `;

    return result;
  }
);

async function startEnvironmentCreation(environmentId: string, req: CreateEnvironmentRequest) {
  // Simulate environment creation
  setTimeout(async () => {
    const containerId = `container_${environmentId}_${Date.now()}`;
    const port = 3000 + Math.floor(Math.random() * 1000);
    const url = `http://localhost:${port}`;

    await executionDB.exec`
      UPDATE environments 
      SET 
        status = 'running',
        container_id = ${containerId},
        port = ${port},
        url = ${url},
        updated_at = NOW()
      WHERE id = ${environmentId}
    `;
  }, 5000);
}

async function executeInContainer(containerId: string, code: string, language: string, fileName?: string): Promise<ExecutionResult> {
  // Mock execution - would integrate with Docker API
  const startTime = Date.now();
  
  // Simulate execution delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const endTime = Date.now();
  
  return {
    output: `Executed ${language} code in container ${containerId}\n\nCode:\n${code}\n\nOutput:\nHello World!`,
    exitCode: 0,
    executionTimeMs: endTime - startTime,
    memoryUsageMB: Math.floor(Math.random() * 100) + 10,
  };
}