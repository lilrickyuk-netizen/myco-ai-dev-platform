import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { deploymentDB } from "./db";
import { Deployment, DeploymentStatus, CreateDeploymentRequest, DeploymentProvider } from "./types";
import { logger } from "../middleware/logging";
import { withRateLimit } from "../middleware/rate-limiter";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface UpdateDeploymentRequest {
  deploymentId: string;
  status?: DeploymentStatus;
  configuration?: Record<string, any>;
  url?: string;
  buildLogs?: string;
  deployLogs?: string;
}

export interface GetDeploymentLogsRequest {
  deploymentId: string;
  logType: 'build' | 'deploy' | 'runtime';
  limit?: number;
  offset?: number;
}

// Create a new deployment
export const createDeployment = withRateLimit(
  'deployment:create:user',
  api<CreateDeploymentRequest, Deployment>(
    { auth: true, expose: true, method: "POST", path: "/deployments" },
    async (req) => {
      const auth = getAuthData()!;

      if (!req.projectId || !req.name || !req.provider || !req.environment) {
        throw APIError.invalidArgument("Project ID, name, provider, and environment are required");
      }

      // Verify project ownership
      const project = await projectsDB.queryRow`
        SELECT id, name FROM projects 
        WHERE id = ${req.projectId} AND user_id = ${auth.userID}
      `;

      if (!project) {
        throw APIError.notFound("Project not found or access denied");
      }

      // Check if deployment name is unique within project
      const existing = await deploymentDB.queryRow`
        SELECT id FROM deployments 
        WHERE project_id = ${req.projectId} AND name = ${req.name}
      `;

      if (existing) {
        throw APIError.alreadyExists("Deployment with this name already exists");
      }

      // Create deployment
      const deployment = await deploymentDB.queryRow<{
        id: string;
        project_id: string;
        name: string;
        provider: string;
        environment: string;
        configuration: string;
        status: DeploymentStatus;
        url: string | null;
        build_logs: string | null;
        deploy_logs: string | null;
        created_at: Date;
        updated_at: Date;
        deployed_at: Date | null;
      }>`
        INSERT INTO deployments (
          project_id, 
          name, 
          provider, 
          environment, 
          configuration, 
          status
        )
        VALUES (
          ${req.projectId}, 
          ${req.name}, 
          ${req.provider}, 
          ${req.environment}, 
          ${JSON.stringify(req.configuration)},
          'pending'
        )
        RETURNING 
          id,
          project_id,
          name,
          provider,
          environment,
          configuration,
          status,
          url,
          build_logs,
          deploy_logs,
          created_at,
          updated_at,
          deployed_at
      `;

      if (!deployment) {
        throw APIError.internal("Failed to create deployment");
      }

      logger.info('Deployment created', undefined, {
        deploymentId: deployment.id,
        projectId: req.projectId,
        provider: req.provider,
        environment: req.environment
      });

      return {
        id: deployment.id,
        projectId: deployment.project_id,
        name: deployment.name,
        provider: deployment.provider,
        environment: deployment.environment,
        configuration: JSON.parse(deployment.configuration),
        status: deployment.status,
        url: deployment.url,
        buildLogs: deployment.build_logs,
        deployLogs: deployment.deploy_logs,
        createdAt: deployment.created_at,
        updatedAt: deployment.updated_at,
        deployedAt: deployment.deployed_at
      };
    }
  )
);

// Get deployment by ID
export const getDeployment = api<{ deploymentId: string }, Deployment | null>(
  { auth: true, expose: true, method: "GET", path: "/deployments/:deploymentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.deploymentId) {
      throw APIError.invalidArgument("Deployment ID is required");
    }

    const deployment = await deploymentDB.queryRow<{
      id: string;
      project_id: string;
      name: string;
      provider: string;
      environment: string;
      configuration: string;
      status: DeploymentStatus;
      url: string | null;
      build_logs: string | null;
      deploy_logs: string | null;
      created_at: Date;
      updated_at: Date;
      deployed_at: Date | null;
    }>`
      SELECT DISTINCT
        d.id,
        d.project_id,
        d.name,
        d.provider,
        d.environment,
        d.configuration,
        d.status,
        d.url,
        d.build_logs,
        d.deploy_logs,
        d.created_at,
        d.updated_at,
        d.deployed_at
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE d.id = ${req.deploymentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!deployment) {
      return null;
    }

    return {
      id: deployment.id,
      projectId: deployment.project_id,
      name: deployment.name,
      provider: deployment.provider,
      environment: deployment.environment,
      configuration: JSON.parse(deployment.configuration),
      status: deployment.status,
      url: deployment.url,
      buildLogs: deployment.build_logs,
      deployLogs: deployment.deploy_logs,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at,
      deployedAt: deployment.deployed_at
    };
  }
);

// List deployments for a project
export const listDeployments = api<{ 
  projectId: string; 
  status?: DeploymentStatus;
  environment?: string;
  limit?: number;
  offset?: number;
}, {
  deployments: Deployment[];
  total: number;
  hasMore: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/deployments" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project access
    const projectAccess = await deploymentDB.queryRow`
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

    const limit = Math.min(req.limit || 50, 100);
    const offset = req.offset || 0;

    let whereConditions = ["project_id = $1"];
    const params: any[] = [req.projectId];
    let paramIndex = 2;

    if (req.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }

    if (req.environment) {
      whereConditions.push(`environment = $${paramIndex++}`);
      params.push(req.environment);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM deployments 
      WHERE ${whereClause}
    `;
    const countResult = await deploymentDB.queryRow<{ count: number }>(countQuery, ...params);
    const total = countResult?.count || 0;

    // Get deployments with pagination
    const deploymentsQuery = `
      SELECT 
        id,
        project_id,
        name,
        provider,
        environment,
        configuration,
        status,
        url,
        build_logs,
        deploy_logs,
        created_at,
        updated_at,
        deployed_at
      FROM deployments 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const deployments = await deploymentDB.query<{
      id: string;
      project_id: string;
      name: string;
      provider: string;
      environment: string;
      configuration: string;
      status: DeploymentStatus;
      url: string | null;
      build_logs: string | null;
      deploy_logs: string | null;
      created_at: Date;
      updated_at: Date;
      deployed_at: Date | null;
    }>(deploymentsQuery, ...params);

    const result = [];
    for await (const deployment of deployments) {
      result.push({
        id: deployment.id,
        projectId: deployment.project_id,
        name: deployment.name,
        provider: deployment.provider,
        environment: deployment.environment,
        configuration: JSON.parse(deployment.configuration),
        status: deployment.status,
        url: deployment.url,
        buildLogs: deployment.build_logs,
        deployLogs: deployment.deploy_logs,
        createdAt: deployment.created_at,
        updatedAt: deployment.updated_at,
        deployedAt: deployment.deployed_at
      });
    }

    return {
      deployments: result,
      total,
      hasMore: offset + result.length < total
    };
  }
);

// Update deployment
export const updateDeployment = api<UpdateDeploymentRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/deployments/:deploymentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.deploymentId) {
      throw APIError.invalidArgument("Deployment ID is required");
    }

    // Verify deployment ownership
    const deployment = await deploymentDB.queryRow`
      SELECT DISTINCT d.id
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = ${req.deploymentId}
      AND p.user_id = ${auth.userID}
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found or access denied");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.status);

      if (req.status === 'deployed') {
        updates.push(`deployed_at = NOW()`);
      }
    }

    if (req.configuration) {
      updates.push(`configuration = $${paramIndex++}`);
      values.push(JSON.stringify(req.configuration));
    }

    if (req.url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(req.url);
    }

    if (req.buildLogs !== undefined) {
      updates.push(`build_logs = $${paramIndex++}`);
      values.push(req.buildLogs);
    }

    if (req.deployLogs !== undefined) {
      updates.push(`deploy_logs = $${paramIndex++}`);
      values.push(req.deployLogs);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("No valid fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.deploymentId);

    const query = `
      UPDATE deployments 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await deploymentDB.exec(query, ...values);

    logger.info('Deployment updated', undefined, {
      deploymentId: req.deploymentId,
      status: req.status
    });

    return { success: true };
  }
);

// Delete deployment
export const deleteDeployment = api<{ deploymentId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/deployments/:deploymentId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.deploymentId) {
      throw APIError.invalidArgument("Deployment ID is required");
    }

    // Verify deployment ownership
    const deployment = await deploymentDB.queryRow<{ status: DeploymentStatus }>`
      SELECT DISTINCT d.status
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = ${req.deploymentId}
      AND p.user_id = ${auth.userID}
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found or access denied");
    }

    // Don't allow deletion of active deployments
    if (deployment.status === 'building' || deployment.status === 'deploying') {
      throw APIError.failedPrecondition("Cannot delete deployment that is currently building or deploying");
    }

    const result = await deploymentDB.exec`
      DELETE FROM deployments WHERE id = ${req.deploymentId}
    `;

    if (result.rowCount === 0) {
      throw APIError.internal("Failed to delete deployment");
    }

    logger.info('Deployment deleted', undefined, {
      deploymentId: req.deploymentId
    });

    return { success: true };
  }
);

// Get deployment logs
export const getDeploymentLogs = api<GetDeploymentLogsRequest, {
  logs: string;
  hasMore: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/deployments/:deploymentId/logs" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.deploymentId || !req.logType) {
      throw APIError.invalidArgument("Deployment ID and log type are required");
    }

    // Verify deployment access
    const deployment = await deploymentDB.queryRow<{
      build_logs: string | null;
      deploy_logs: string | null;
    }>`
      SELECT DISTINCT d.build_logs, d.deploy_logs
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE d.id = ${req.deploymentId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found or access denied");
    }

    let logs = '';
    if (req.logType === 'build') {
      logs = deployment.build_logs || '';
    } else if (req.logType === 'deploy') {
      logs = deployment.deploy_logs || '';
    } else if (req.logType === 'runtime') {
      // Runtime logs would typically come from external logging service
      logs = 'Runtime logs not available in this implementation';
    }

    // Apply pagination if requested
    if (req.limit || req.offset) {
      const lines = logs.split('\n');
      const offset = req.offset || 0;
      const limit = req.limit || 1000;
      const paginatedLines = lines.slice(offset, offset + limit);
      
      return {
        logs: paginatedLines.join('\n'),
        hasMore: offset + paginatedLines.length < lines.length
      };
    }

    return {
      logs,
      hasMore: false
    };
  }
);

// Get available deployment providers
export const getProviders = api<void, DeploymentProvider[]>(
  { auth: true, expose: true, method: "GET", path: "/deployments/providers" },
  async () => {
    // This would typically be stored in a database or fetched from external sources
    return [
      {
        id: 'vercel',
        name: 'Vercel',
        description: 'Deploy to Vercel for serverless applications',
        icon: 'vercel',
        supportedTypes: ['web', 'api'],
        features: ['serverless', 'edge-functions', 'automatic-ssl', 'cdn'],
        regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
      },
      {
        id: 'netlify',
        name: 'Netlify',
        description: 'Deploy to Netlify for JAMstack applications',
        icon: 'netlify',
        supportedTypes: ['web'],
        features: ['cdn', 'automatic-ssl', 'forms', 'functions'],
        regions: ['us-east-1', 'us-west-2', 'eu-west-1']
      },
      {
        id: 'aws',
        name: 'AWS',
        description: 'Deploy to Amazon Web Services',
        icon: 'aws',
        supportedTypes: ['web', 'api', 'database'],
        features: ['scalable', 'load-balancing', 'auto-scaling', 'monitoring'],
        regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1']
      },
      {
        id: 'gcp',
        name: 'Google Cloud Platform',
        description: 'Deploy to Google Cloud Platform',
        icon: 'gcp',
        supportedTypes: ['web', 'api', 'database'],
        features: ['kubernetes', 'serverless', 'auto-scaling', 'monitoring'],
        regions: ['us-central1', 'us-east1', 'europe-west1', 'asia-east1']
      },
      {
        id: 'digitalocean',
        name: 'DigitalOcean',
        description: 'Deploy to DigitalOcean droplets and apps',
        icon: 'digitalocean',
        supportedTypes: ['web', 'api'],
        features: ['simple-deployment', 'monitoring', 'load-balancing'],
        regions: ['nyc1', 'sfo3', 'ams3', 'sgp1', 'lon1']
      }
    ];
  }
);

// Get deployment environments
export const getEnvironments = api<void, Array<{
  id: string;
  name: string;
  description: string;
  features: string[];
}>>(
  { auth: true, expose: true, method: "GET", path: "/deployments/environments" },
  async () => {
    return [
      {
        id: 'development',
        name: 'Development',
        description: 'Development environment for testing',
        features: ['hot-reload', 'debug-mode', 'mock-services']
      },
      {
        id: 'staging',
        name: 'Staging',
        description: 'Staging environment for pre-production testing',
        features: ['production-like', 'integration-testing', 'performance-testing']
      },
      {
        id: 'production',
        name: 'Production',
        description: 'Production environment for live applications',
        features: ['high-availability', 'monitoring', 'backup', 'security']
      },
      {
        id: 'preview',
        name: 'Preview',
        description: 'Temporary environment for feature previews',
        features: ['temporary', 'branch-deployment', 'quick-setup']
      }
    ];
  }
);