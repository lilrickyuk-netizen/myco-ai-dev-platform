import { api, APIError, StreamOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { executionDB } from "./db";
import { Environment, EnvironmentStatus, EnvironmentType, CreateEnvironmentRequest, ExecutionResult } from "./types";
import { logger } from "../middleware/logging";
import { withRateLimit } from "../middleware/rate-limiter";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface UpdateEnvironmentRequest {
  environmentId: string;
  status?: EnvironmentStatus;
  configuration?: Record<string, any>;
  containerId?: string;
  port?: number;
  url?: string;
}

export interface ExecuteCodeRequest {
  environmentId: string;
  code: string;
  language?: string;
  timeout?: number;
}

export interface EnvironmentLogsRequest {
  environmentId: string;
  lines?: number;
  follow?: boolean;
}

// Create a new execution environment
export const createEnvironment = withRateLimit(
  'environment:create:user',
  api<CreateEnvironmentRequest, Environment>(
    { auth: true, expose: true, method: "POST", path: "/execution/environments" },
    async (req) => {
      const auth = getAuthData()!;

      if (!req.projectId || !req.name || !req.type) {
        throw APIError.invalidArgument("Project ID, name, and type are required");
      }

      // Verify project ownership or collaboration
      const project = await projectsDB.queryRow`
        SELECT DISTINCT p.id
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = ${req.projectId}
        AND (
          p.user_id = ${auth.userID} 
          OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
        )
      `;

      if (!project) {
        throw APIError.notFound("Project not found or access denied");
      }

      // Check if environment name is unique within project
      const existing = await executionDB.queryRow`
        SELECT id FROM environments 
        WHERE project_id = ${req.projectId} AND name = ${req.name}
      `;

      if (existing) {
        throw APIError.alreadyExists("Environment with this name already exists");
      }

      // Validate configuration based on environment type
      const config = validateEnvironmentConfig(req.type, req.configuration);

      // Create environment
      const environment = await executionDB.queryRow<{
        id: string;
        project_id: string;
        name: string;
        type: EnvironmentType;
        configuration: string;
        status: EnvironmentStatus;
        container_id: string | null;
        port: number | null;
        url: string | null;
        created_at: Date;
        updated_at: Date;
      }>`
        INSERT INTO environments (
          project_id, 
          name, 
          type, 
          configuration, 
          status
        )
        VALUES (
          ${req.projectId}, 
          ${req.name}, 
          ${req.type}, 
          ${JSON.stringify(config)},
          'creating'
        )
        RETURNING 
          id,
          project_id,
          name,
          type,
          configuration,
          status,
          container_id,
          port,
          url,
          created_at,
          updated_at
      `;

      if (!environment) {
        throw APIError.internal("Failed to create environment");
      }

      logger.info('Execution environment created', undefined, {
        environmentId: environment.id,
        projectId: req.projectId,
        type: req.type,
        name: req.name
      });

      // In a real implementation, you would trigger container creation here
      // For now, we'll just return the environment record
      return {
        id: environment.id,
        projectId: environment.project_id,
        name: environment.name,
        type: environment.type,
        configuration: JSON.parse(environment.configuration),
        status: environment.status,
        containerId: environment.container_id,
        port: environment.port,
        url: environment.url,
        createdAt: environment.created_at,
        updatedAt: environment.updated_at
      };
    }
  )
);

// Get environment by ID
export const getEnvironment = api<{ environmentId: string }, Environment | null>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/:environmentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.environmentId) {
      throw APIError.invalidArgument("Environment ID is required");
    }

    const environment = await executionDB.queryRow<{
      id: string;
      project_id: string;
      name: string;
      type: EnvironmentType;
      configuration: string;
      status: EnvironmentStatus;
      container_id: string | null;
      port: number | null;
      url: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT DISTINCT
        e.id,
        e.project_id,
        e.name,
        e.type,
        e.configuration,
        e.status,
        e.container_id,
        e.port,
        e.url,
        e.created_at,
        e.updated_at
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE e.id = ${req.environmentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!environment) {
      return null;
    }

    return {
      id: environment.id,
      projectId: environment.project_id,
      name: environment.name,
      type: environment.type,
      configuration: JSON.parse(environment.configuration),
      status: environment.status,
      containerId: environment.container_id,
      port: environment.port,
      url: environment.url,
      createdAt: environment.created_at,
      updatedAt: environment.updated_at
    };
  }
);

// List environments for a project
export const listEnvironments = api<{ 
  projectId: string; 
  status?: EnvironmentStatus;
  type?: EnvironmentType;
}, Environment[]>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project access
    const projectAccess = await executionDB.queryRow`
      SELECT DISTINCT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or access denied");
    }

    let whereConditions = ["project_id = $1"];
    const params: any[] = [req.projectId];
    let paramIndex = 2;

    if (req.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }

    if (req.type) {
      whereConditions.push(`type = $${paramIndex++}`);
      params.push(req.type);
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT 
        id,
        project_id,
        name,
        type,
        configuration,
        status,
        container_id,
        port,
        url,
        created_at,
        updated_at
      FROM environments 
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `;

    const environments = await executionDB.query<{
      id: string;
      project_id: string;
      name: string;
      type: EnvironmentType;
      configuration: string;
      status: EnvironmentStatus;
      container_id: string | null;
      port: number | null;
      url: string | null;
      created_at: Date;
      updated_at: Date;
    }>(query, ...params);

    const result = [];
    for await (const environment of environments) {
      result.push({
        id: environment.id,
        projectId: environment.project_id,
        name: environment.name,
        type: environment.type,
        configuration: JSON.parse(environment.configuration),
        status: environment.status,
        containerId: environment.container_id,
        port: environment.port,
        url: environment.url,
        createdAt: environment.created_at,
        updatedAt: environment.updated_at
      });
    }

    return result;
  }
);

// Update environment
export const updateEnvironment = api<UpdateEnvironmentRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/execution/environments/:environmentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.environmentId) {
      throw APIError.invalidArgument("Environment ID is required");
    }

    // Verify environment ownership
    const environment = await executionDB.queryRow`
      SELECT DISTINCT e.id
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE e.id = ${req.environmentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found or access denied");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.status);
    }

    if (req.configuration) {
      updates.push(`configuration = $${paramIndex++}`);
      values.push(JSON.stringify(req.configuration));
    }

    if (req.containerId !== undefined) {
      updates.push(`container_id = $${paramIndex++}`);
      values.push(req.containerId);
    }

    if (req.port !== undefined) {
      updates.push(`port = $${paramIndex++}`);
      values.push(req.port);
    }

    if (req.url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(req.url);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No valid fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.environmentId);

    const query = `
      UPDATE environments 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await executionDB.exec(query, ...values);

    logger.info('Environment updated', undefined, {
      environmentId: req.environmentId,
      status: req.status
    });

    return { success: true };
  }
);

// Delete environment
export const deleteEnvironment = api<{ environmentId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/execution/environments/:environmentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.environmentId) {
      throw APIError.invalidArgument("Environment ID is required");
    }

    // Verify environment ownership
    const environment = await executionDB.queryRow<{ 
      status: EnvironmentStatus;
      container_id: string | null;
    }>`
      SELECT DISTINCT e.status, e.container_id
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      WHERE e.id = ${req.environmentId}
      AND p.user_id = ${auth.userID}
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found or access denied");
    }

    // Update status to deleting first
    await executionDB.exec`
      UPDATE environments 
      SET status = 'deleting', updated_at = NOW()
      WHERE id = ${req.environmentId}
    `;

    // In a real implementation, you would stop and remove the container here
    if (environment.container_id) {
      logger.info('Would stop and remove container', undefined, {
        environmentId: req.environmentId,
        containerId: environment.container_id
      });
      // stopContainer(environment.container_id);
    }

    // Delete the environment record
    const result = await executionDB.exec`
      DELETE FROM environments WHERE id = ${req.environmentId}
    `;

    if (result.rowCount === 0) {
      throw APIError.internal("Failed to delete environment");
    }

    logger.info('Environment deleted', undefined, {
      environmentId: req.environmentId
    });

    return { success: true };
  }
);

// Execute code in an environment
export const executeCode = withRateLimit(
  'execution:user',
  api<ExecuteCodeRequest, ExecutionResult>(
    { auth: true, expose: true, method: "POST", path: "/execution/environments/:environmentId/execute" },
    async (req) => {
      const auth = getAuthData()!;

      if (!req.environmentId || !req.code) {
        throw APIError.invalidArgument("Environment ID and code are required");
      }

      // Verify environment access
      const environment = await executionDB.queryRow<{
        status: EnvironmentStatus;
        type: EnvironmentType;
        configuration: string;
        container_id: string | null;
      }>`
        SELECT DISTINCT e.status, e.type, e.configuration, e.container_id
        FROM environments e
        JOIN projects p ON e.project_id = p.id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE e.id = ${req.environmentId}
        AND (
          p.user_id = ${auth.userID} 
          OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
        )
      `;

      if (!environment) {
        throw APIError.notFound("Environment not found or access denied");
      }

      if (environment.status !== 'running') {
        throw APIError.failedPrecondition("Environment is not running");
      }

      const timeout = Math.min(req.timeout || 30000, 300000); // Max 5 minutes
      const startTime = Date.now();

      try {
        // In a real implementation, this would execute code in the container
        // For now, we'll simulate execution based on the language
        const result = await simulateCodeExecution(
          req.code, 
          environment.type, 
          timeout,
          JSON.parse(environment.configuration)
        );

        const executionTime = Date.now() - startTime;

        logger.info('Code executed', undefined, {
          environmentId: req.environmentId,
          language: environment.type,
          executionTimeMs: executionTime,
          codeLength: req.code.length
        });

        return {
          ...result,
          executionTimeMs: executionTime
        };

      } catch (error) {
        logger.error('Code execution failed', error as Error, {
          environmentId: req.environmentId,
          language: environment.type
        });

        return {
          output: '',
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          memoryUsageMB: 0,
          error: (error as Error).message
        };
      }
    }
  )
);

// Get environment logs
export const getEnvironmentLogs = api<EnvironmentLogsRequest, { logs: string }>(
  { auth: true, expose: true, method: "GET", path: "/execution/environments/:environmentId/logs" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.environmentId) {
      throw APIError.invalidArgument("Environment ID is required");
    }

    // Verify environment access
    const environment = await executionDB.queryRow<{ container_id: string | null }>`
      SELECT DISTINCT e.container_id
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE e.id = ${req.environmentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!environment) {
      throw APIError.notFound("Environment not found or access denied");
    }

    // In a real implementation, this would fetch logs from the container
    const logs = `[${new Date().toISOString()}] Environment ${req.environmentId} started
[${new Date().toISOString()}] Container ready for code execution
[${new Date().toISOString()}] Waiting for execution requests...`;

    return { logs };
  }
);

// Stream environment logs
export const streamEnvironmentLogs = api.streamOut<EnvironmentLogsRequest, { timestamp: Date; level: string; message: string }>(
  { auth: true, expose: true, path: "/execution/environments/:environmentId/logs/stream" },
  async (req, stream) => {
    const auth = getAuthData()!;

    if (!req.environmentId) {
      return;
    }

    // Verify environment access
    const environment = await executionDB.queryRow<{ container_id: string | null }>`
      SELECT DISTINCT e.container_id
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE e.id = ${req.environmentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!environment) {
      return;
    }

    // Simulate streaming logs
    const interval = setInterval(async () => {
      try {
        await stream.send({
          timestamp: new Date(),
          level: 'info',
          message: `Environment ${req.environmentId} is running normally`
        });
      } catch (error) {
        clearInterval(interval);
      }
    }, 5000);

    // Clean up on stream close
    setTimeout(() => {
      clearInterval(interval);
    }, 300000); // 5 minutes max
  }
);

// Helper functions
function validateEnvironmentConfig(type: EnvironmentType, config: Record<string, any>): Record<string, any> {
  const defaults: Record<EnvironmentType, Record<string, any>> = {
    nodejs: {
      image: 'node:18-alpine',
      runtime: 'nodejs',
      version: '18',
      memory: '512m',
      cpu: 1
    },
    python: {
      image: 'python:3.11-alpine',
      runtime: 'python',
      version: '3.11',
      memory: '512m',
      cpu: 1
    },
    java: {
      image: 'openjdk:17-alpine',
      runtime: 'java',
      version: '17',
      memory: '1g',
      cpu: 2
    },
    go: {
      image: 'golang:1.20-alpine',
      runtime: 'go',
      version: '1.20',
      memory: '256m',
      cpu: 1
    },
    rust: {
      image: 'rust:1.70-alpine',
      runtime: 'rust',
      version: '1.70',
      memory: '512m',
      cpu: 2
    },
    php: {
      image: 'php:8.2-alpine',
      runtime: 'php',
      version: '8.2',
      memory: '256m',
      cpu: 1
    },
    ruby: {
      image: 'ruby:3.2-alpine',
      runtime: 'ruby',
      version: '3.2',
      memory: '512m',
      cpu: 1
    },
    docker: {
      image: config.image || 'alpine:latest',
      memory: '256m',
      cpu: 1
    },
    custom: {
      image: config.image || 'alpine:latest',
      memory: '256m',
      cpu: 1
    }
  };

  return {
    ...defaults[type],
    ...config
  };
}

async function simulateCodeExecution(
  code: string, 
  type: EnvironmentType, 
  timeout: number,
  config: Record<string, any>
): Promise<Omit<ExecutionResult, 'executionTimeMs'>> {
  // Simulate different execution results based on code content
  if (code.includes('error') || code.includes('throw')) {
    return {
      output: `Error: Simulated ${type} execution error`,
      exitCode: 1,
      memoryUsageMB: Math.random() * 50,
      error: 'Execution failed'
    };
  }

  if (code.includes('print') || code.includes('console.log') || code.includes('echo')) {
    return {
      output: `Hello from ${type} environment!\nExecution completed successfully.`,
      exitCode: 0,
      memoryUsageMB: Math.random() * 100
    };
  }

  return {
    output: `Code executed successfully in ${type} environment.\nNo output generated.`,
    exitCode: 0,
    memoryUsageMB: Math.random() * 30
  };
}