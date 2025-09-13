import { api } from "encore.dev/api";
import { DB } from "./db";
import type { 
  ExecutionEnvironment, 
  CreateEnvironmentRequest, 
  ExecutionRequest, 
  ExecutionResult,
  TerminalSession,
  PackageManagerOperation 
} from "./types";

// Docker management functions (simplified for demo)
class DockerManager {
  async createContainer(config: any): Promise<string> {
    // In real implementation, this would use Docker API
    return "container-" + Math.random().toString(36).substr(2, 9);
  }

  async startContainer(containerId: string): Promise<void> {
    // Start container implementation
    console.log(`Starting container: ${containerId}`);
  }

  async stopContainer(containerId: string): Promise<void> {
    // Stop container implementation
    console.log(`Stopping container: ${containerId}`);
  }

  async executeCommand(containerId: string, command: string): Promise<any> {
    // Execute command in container
    return {
      exitCode: 0,
      stdout: `Executed: ${command}`,
      stderr: "",
      duration: 1000
    };
  }

  async removeContainer(containerId: string): Promise<void> {
    // Remove container implementation
    console.log(`Removing container: ${containerId}`);
  }
}

const dockerManager = new DockerManager();

export const createEnvironment = api(
  { method: "POST", path: "/environments", expose: true },
  async (req: CreateEnvironmentRequest): Promise<ExecutionEnvironment> => {
    const name = req.name || `${req.runtime}-${Date.now()}`;
    const version = req.version || 'latest';
    const image = getDockerImage(req.runtime, version);
    
    // Create Docker container
    const containerId = await dockerManager.createContainer({
      image,
      environment: req.environment || {},
      resources: req.resources || { cpu: 1, memory: 512, storage: 1024 }
    });

    // Save to database
    const result = await DB.exec`
      INSERT INTO execution_environments (
        name, runtime, version, image, project_id, container_id, environment, resources
      ) VALUES (
        ${name}, ${req.runtime}, ${version}, ${image}, ${req.projectId}, 
        ${containerId}, ${JSON.stringify(req.environment || {})}, 
        ${JSON.stringify(req.resources || { cpu: 1, memory: 512, storage: 1024 })}
      )
      RETURNING *
    `;

    const env = result.rows[0];
    
    // Start the container
    await dockerManager.startContainer(containerId);
    
    // Update status to running
    await DB.exec`
      UPDATE execution_environments 
      SET status = 'running' 
      WHERE id = ${env.id}
    `;

    return {
      id: env.id,
      name: env.name,
      runtime: env.runtime,
      version: env.version,
      image: env.image,
      status: 'running',
      projectId: env.project_id,
      containerId: env.container_id,
      ports: JSON.parse(env.ports),
      environment: JSON.parse(env.environment),
      resources: JSON.parse(env.resources),
      createdAt: env.created_at,
      lastUsedAt: env.last_used_at,
    };
  }
);

export const listEnvironments = api(
  { method: "GET", path: "/environments/:projectId", expose: true },
  async ({ projectId }: { projectId: string }): Promise<{ environments: ExecutionEnvironment[] }> => {
    const result = await DB.exec`
      SELECT * FROM execution_environments 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;

    const environments = result.rows.map(env => ({
      id: env.id,
      name: env.name,
      runtime: env.runtime,
      version: env.version,
      image: env.image,
      status: env.status,
      projectId: env.project_id,
      containerId: env.container_id,
      ports: JSON.parse(env.ports),
      environment: JSON.parse(env.environment),
      resources: JSON.parse(env.resources),
      createdAt: env.created_at,
      lastUsedAt: env.last_used_at,
    }));

    return { environments };
  }
);

export const executeCommand = api(
  { method: "POST", path: "/execute", expose: true },
  async (req: ExecutionRequest): Promise<ExecutionResult> => {
    // Get or create environment
    let environment: any;
    
    if (req.runtime) {
      // Create temporary environment
      const envReq: CreateEnvironmentRequest = {
        projectId: req.projectId,
        runtime: req.runtime,
        name: `temp-${Date.now()}`
      };
      environment = await createEnvironment(envReq);
    } else {
      // Use existing environment
      const result = await DB.exec`
        SELECT * FROM execution_environments 
        WHERE project_id = ${req.projectId} AND status = 'running'
        ORDER BY last_used_at DESC
        LIMIT 1
      `;
      
      if (result.rows.length === 0) {
        throw new Error("No running environment found for project");
      }
      
      environment = result.rows[0];
    }

    const startTime = new Date();
    
    // Execute command in container
    const execResult = await dockerManager.executeCommand(
      environment.container_id, 
      req.command
    );
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Save execution result
    const resultRecord = await DB.exec`
      INSERT INTO execution_results (
        environment_id, project_id, command, exit_code, stdout, stderr, 
        duration, started_at, completed_at
      ) VALUES (
        ${environment.id}, ${req.projectId}, ${req.command}, ${execResult.exitCode},
        ${execResult.stdout}, ${execResult.stderr}, ${duration}, ${startTime}, ${endTime}
      )
      RETURNING *
    `;

    // Update environment last used time
    await DB.exec`
      UPDATE execution_environments 
      SET last_used_at = NOW() 
      WHERE id = ${environment.id}
    `;

    const result = resultRecord.rows[0];
    return {
      id: result.id,
      command: result.command,
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
      startedAt: result.started_at,
      completedAt: result.completed_at,
      environment: environment.id,
    };
  }
);

export const stopEnvironment = api(
  { method: "POST", path: "/environments/:environmentId/stop", expose: true },
  async ({ environmentId }: { environmentId: string }): Promise<{ success: boolean }> => {
    // Get environment
    const result = await DB.exec`
      SELECT * FROM execution_environments WHERE id = ${environmentId}
    `;
    
    if (result.rows.length === 0) {
      throw new Error("Environment not found");
    }

    const environment = result.rows[0];
    
    // Stop Docker container
    if (environment.container_id) {
      await dockerManager.stopContainer(environment.container_id);
    }

    // Update status
    await DB.exec`
      UPDATE execution_environments 
      SET status = 'stopped' 
      WHERE id = ${environmentId}
    `;

    return { success: true };
  }
);

export const deleteEnvironment = api(
  { method: "DELETE", path: "/environments/:environmentId", expose: true },
  async ({ environmentId }: { environmentId: string }): Promise<{ success: boolean }> => {
    // Get environment
    const result = await DB.exec`
      SELECT * FROM execution_environments WHERE id = ${environmentId}
    `;
    
    if (result.rows.length === 0) {
      throw new Error("Environment not found");
    }

    const environment = result.rows[0];
    
    // Remove Docker container
    if (environment.container_id) {
      await dockerManager.removeContainer(environment.container_id);
    }

    // Delete from database (CASCADE will handle related records)
    await DB.exec`
      DELETE FROM execution_environments WHERE id = ${environmentId}
    `;

    return { success: true };
  }
);

export const installPackages = api(
  { method: "POST", path: "/packages/install", expose: true },
  async (req: PackageManagerOperation): Promise<{ operationId: string; status: string }> => {
    // Get environment
    const envResult = await DB.exec`
      SELECT * FROM execution_environments 
      WHERE project_id = ${req.projectId} AND status = 'running'
      ORDER BY last_used_at DESC
      LIMIT 1
    `;
    
    if (envResult.rows.length === 0) {
      throw new Error("No running environment found");
    }

    const environment = envResult.rows[0];

    // Create operation record
    const opResult = await DB.exec`
      INSERT INTO package_operations (
        project_id, environment_id, manager, operation, packages, options, status
      ) VALUES (
        ${req.projectId}, ${environment.id}, ${req.manager}, ${req.operation},
        ${JSON.stringify(req.packages || [])}, ${JSON.stringify(req.options || {})}, 'running'
      )
      RETURNING id
    `;

    const operationId = opResult.rows[0].id;

    // Build package manager command
    const command = buildPackageCommand(req);
    
    // Execute package manager command
    try {
      const execResult = await dockerManager.executeCommand(environment.container_id, command);
      
      await DB.exec`
        UPDATE package_operations 
        SET status = 'completed', result = ${JSON.stringify(execResult)}, completed_at = NOW()
        WHERE id = ${operationId}
      `;
      
      return { operationId, status: 'completed' };
    } catch (error) {
      await DB.exec`
        UPDATE package_operations 
        SET status = 'failed', result = ${JSON.stringify({ error: error.message })}, completed_at = NOW()
        WHERE id = ${operationId}
      `;
      
      return { operationId, status: 'failed' };
    }
  }
);

function getDockerImage(runtime: string, version: string): string {
  const images: Record<string, string> = {
    'node': `node:${version}-alpine`,
    'python': `python:${version}-alpine`,
    'java': `openjdk:${version}-alpine`,
    'go': `golang:${version}-alpine`,
    'rust': `rust:${version}-alpine`,
    'php': `php:${version}-alpine`,
    'ruby': `ruby:${version}-alpine`,
    'dotnet': `mcr.microsoft.com/dotnet/sdk:${version}-alpine`
  };
  
  return images[runtime] || `${runtime}:${version}`;
}

function buildPackageCommand(req: PackageManagerOperation): string {
  const { manager, operation, packages = [] } = req;
  
  const commands: Record<string, Record<string, string>> = {
    'npm': {
      'install': `npm install ${packages.join(' ')}`,
      'uninstall': `npm uninstall ${packages.join(' ')}`,
      'update': 'npm update',
      'list': 'npm list',
      'audit': 'npm audit'
    },
    'yarn': {
      'install': `yarn add ${packages.join(' ')}`,
      'uninstall': `yarn remove ${packages.join(' ')}`,
      'update': 'yarn upgrade',
      'list': 'yarn list',
      'audit': 'yarn audit'
    },
    'pip': {
      'install': `pip install ${packages.join(' ')}`,
      'uninstall': `pip uninstall -y ${packages.join(' ')}`,
      'update': `pip install --upgrade ${packages.join(' ')}`,
      'list': 'pip list',
      'audit': 'pip-audit'
    }
  };
  
  return commands[manager]?.[operation] || `${manager} ${operation}`;
}