import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { executionDB } from "./db";
import { projectsDB } from "../projects/db";
import { ExecutionEnvironment, Runtime } from "./types";

export interface CreateEnvironmentRequest {
  projectId: string;
  name: string;
  runtime: string;
  version: string;
  cpuLimit?: string;
  memoryLimit?: string;
}

export interface ListEnvironmentsParams {
  projectId: string;
}

export interface ListEnvironmentsResponse {
  environments: ExecutionEnvironment[];
}

export interface GetEnvironmentParams {
  id: string;
}

export interface ListRuntimesResponse {
  runtimes: Runtime[];
}

// Creates a new execution environment.
export const createEnvironment = api<CreateEnvironmentRequest, ExecutionEnvironment>(
  { auth: true, expose: true, method: "POST", path: "/execution/environments" },
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

    // Check if environment name already exists for this project
    const existing = await executionDB.queryRow`
      SELECT id FROM execution_environments 
      WHERE project_id = ${req.projectId} AND name = ${req.name}
    `;

    if (existing) {
      throw APIError.alreadyExists("Environment with this name already exists");
    }

    // Create the environment
    const environment = await executionDB.queryRow<ExecutionEnvironment>`
      INSERT INTO execution_environments (
        project_id, name, runtime, version, cpu_limit, memory_limit, user_id, status
      )
      VALUES (
        ${req.projectId}, 
        ${req.name}, 
        ${req.runtime}, 
        ${req.version}, 
        ${req.cpuLimit || '1'}, 
        ${req.memoryLimit || '512Mi'}, 
        ${auth.userID},
        'creating'
      )
      RETURNING 
        id,
        project_id as "projectId",
        name,
        runtime,
        version,
        status,
        container_id as "containerId",
        port,
        cpu_limit as "cpuLimit",
        memory_limit as "memoryLimit",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!environment) {
      throw APIError.internal("Failed to create environment");
    }

    // TODO: Start container creation process asynchronously
    startEnvironmentCreation(environment.id);

    return environment;
  }
);

// Lists all environments for a project.
export const listEnvironments = api<ListEnvironmentsParams, ListEnvironmentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/:projectId" },
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

    const environments: ExecutionEnvironment[] = [];
    
    for await (const row of executionDB.query<ExecutionEnvironment>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        runtime,
        version,
        status,
        container_id as "containerId",
        port,
        cpu_limit as "cpuLimit",
        memory_limit as "memoryLimit",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM execution_environments 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `) {
      environments.push(row);
    }

    return { environments };
  }
);

// Gets a specific environment by ID.
export const getEnvironment = api<GetEnvironmentParams, ExecutionEnvironment>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/env/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const environment = await executionDB.queryRow<ExecutionEnvironment>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        runtime,
        version,
        status,
        container_id as "containerId",
        port,
        cpu_limit as "cpuLimit",
        memory_limit as "memoryLimit",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM execution_environments 
      WHERE id = ${id}
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${environment.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    return environment;
  }
);

// Lists available runtimes.
export const listRuntimes = api<void, ListRuntimesResponse>(
  { auth: true, expose: true, method: "GET", path: "/execution/runtimes" },
  async () => {
    const runtimes: Runtime[] = [
      {
        name: "node",
        displayName: "Node.js",
        versions: ["18", "20", "21"],
        dockerImage: "node",
        defaultCommand: "npm start",
        packageManager: "npm",
        installCommand: "npm install",
        runCommand: "npm start",
        buildCommand: "npm run build",
        extensions: [".js", ".ts", ".jsx", ".tsx"]
      },
      {
        name: "python",
        displayName: "Python",
        versions: ["3.9", "3.10", "3.11", "3.12"],
        dockerImage: "python",
        defaultCommand: "python main.py",
        packageManager: "pip",
        installCommand: "pip install -r requirements.txt",
        runCommand: "python main.py",
        extensions: [".py"]
      },
      {
        name: "go",
        displayName: "Go",
        versions: ["1.19", "1.20", "1.21"],
        dockerImage: "golang",
        defaultCommand: "go run main.go",
        packageManager: "go",
        installCommand: "go mod download",
        runCommand: "go run .",
        buildCommand: "go build",
        extensions: [".go"]
      },
      {
        name: "rust",
        displayName: "Rust",
        versions: ["1.70", "1.71", "1.72"],
        dockerImage: "rust",
        defaultCommand: "cargo run",
        packageManager: "cargo",
        installCommand: "cargo fetch",
        runCommand: "cargo run",
        buildCommand: "cargo build",
        extensions: [".rs"]
      }
    ];

    return { runtimes };
  }
);

// Helper function to start environment creation (would be implemented with actual container orchestration)
async function startEnvironmentCreation(environmentId: string) {
  // This would integrate with Docker or Kubernetes to create the actual environment
  // For now, we'll just update the status to ready after a delay
  setTimeout(async () => {
    await executionDB.exec`
      UPDATE execution_environments 
      SET status = 'ready', updated_at = NOW()
      WHERE id = ${environmentId}
    `;
  }, 5000);
}