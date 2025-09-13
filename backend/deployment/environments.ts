import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { deploymentDB } from "./db";
import { projectsDB } from "../projects/db";
import { Deployment, DeploymentProvider, DeploymentHistory } from "./types";

export interface CreateDeploymentRequest {
  projectId: string;
  providerId: string;
  name: string;
  environment?: string;
  config: Record<string, any>;
}

export interface ListDeploymentsParams {
  projectId: string;
}

export interface ListDeploymentsResponse {
  deployments: Deployment[];
}

export interface GetDeploymentParams {
  id: string;
}

export interface ListProvidersResponse {
  providers: DeploymentProvider[];
}

export interface DeployParams {
  id: string;
}

export interface DeployResponse {
  deployment: Deployment;
  historyId: string;
}

// Creates a new deployment configuration.
export const createDeployment = api<CreateDeploymentRequest, Deployment>(
  { auth: true, expose: true, method: "POST", path: "/deployment/deployments" },
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

    // Verify provider exists
    const provider = await deploymentDB.queryRow`
      SELECT id FROM deployment_providers 
      WHERE id = ${req.providerId} AND enabled = TRUE
    `;

    if (!provider) {
      throw APIError.notFound("Provider not found or disabled");
    }

    // Check if deployment name already exists for this project/environment
    const existing = await deploymentDB.queryRow`
      SELECT id FROM deployments 
      WHERE project_id = ${req.projectId} 
      AND name = ${req.name} 
      AND environment = ${req.environment || 'production'}
    `;

    if (existing) {
      throw APIError.alreadyExists("Deployment with this name already exists in this environment");
    }

    // Create the deployment
    const deployment = await deploymentDB.queryRow<Deployment>`
      INSERT INTO deployments (
        project_id, provider_id, name, environment, config, user_id, status
      )
      VALUES (
        ${req.projectId}, 
        ${req.providerId}, 
        ${req.name}, 
        ${req.environment || 'production'}, 
        ${JSON.stringify(req.config)}, 
        ${auth.userID},
        'pending'
      )
      RETURNING 
        id,
        project_id as "projectId",
        provider_id as "providerId",
        name,
        environment,
        status,
        config,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        url,
        last_deployed_at as "lastDeployedAt",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!deployment) {
      throw APIError.internal("Failed to create deployment");
    }

    return {
      ...deployment,
      config: typeof deployment.config === 'string' ? JSON.parse(deployment.config) : deployment.config,
    };
  }
);

// Lists all deployments for a project.
export const listDeployments = api<ListDeploymentsParams, ListDeploymentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/deployment/deployments/:projectId" },
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

    const deployments: Deployment[] = [];
    
    for await (const row of deploymentDB.query<Deployment>`
      SELECT 
        id,
        project_id as "projectId",
        provider_id as "providerId",
        name,
        environment,
        status,
        config,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        url,
        last_deployed_at as "lastDeployedAt",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM deployments 
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `) {
      deployments.push({
        ...row,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      });
    }

    return { deployments };
  }
);

// Gets a specific deployment by ID.
export const getDeployment = api<GetDeploymentParams, Deployment>(
  { auth: true, expose: true, method: "GET", path: "/deployment/deployments/deploy/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const deployment = await deploymentDB.queryRow<Deployment>`
      SELECT 
        id,
        project_id as "projectId",
        provider_id as "providerId",
        name,
        environment,
        status,
        config,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        url,
        last_deployed_at as "lastDeployedAt",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM deployments 
      WHERE id = ${id}
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${deployment.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    return {
      ...deployment,
      config: typeof deployment.config === 'string' ? JSON.parse(deployment.config) : deployment.config,
    };
  }
);

// Lists available deployment providers.
export const listProviders = api<void, ListProvidersResponse>(
  { auth: true, expose: true, method: "GET", path: "/deployment/providers" },
  async () => {
    const providers: DeploymentProvider[] = [];
    
    for await (const row of deploymentDB.query<DeploymentProvider>`
      SELECT 
        id,
        name,
        display_name as "displayName",
        type,
        config_schema as "configSchema",
        enabled,
        created_at as "createdAt"
      FROM deployment_providers 
      WHERE enabled = TRUE
      ORDER BY display_name ASC
    `) {
      providers.push({
        ...row,
        configSchema: typeof row.configSchema === 'string' ? JSON.parse(row.configSchema) : row.configSchema,
      });
    }

    return { providers };
  }
);

// Triggers a new deployment.
export const deploy = api<DeployParams, DeployResponse>(
  { auth: true, expose: true, method: "POST", path: "/deployment/deployments/:id/deploy" },
  async ({ id }) => {
    const auth = getAuthData()!;

    // Get deployment and verify ownership
    const deployment = await deploymentDB.queryRow<Deployment>`
      SELECT 
        id,
        project_id as "projectId",
        provider_id as "providerId",
        name,
        environment,
        status,
        config,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        url,
        last_deployed_at as "lastDeployedAt",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM deployments 
      WHERE id = ${id}
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found");
    }

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${deployment.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    // Update deployment status to building
    await deploymentDB.exec`
      UPDATE deployments 
      SET status = 'building', updated_at = NOW()
      WHERE id = ${id}
    `;

    // Create deployment history entry
    const history = await deploymentDB.queryRow<{ id: string }>`
      INSERT INTO deployment_history (deployment_id, version, status, deployed_by)
      VALUES (${id}, ${generateVersion()}, 'building', ${auth.userID})
      RETURNING id
    `;

    if (!history) {
      throw APIError.internal("Failed to create deployment history");
    }

    // Start deployment process asynchronously
    startDeploymentProcess(id, history.id);

    const updatedDeployment = {
      ...deployment,
      status: 'building' as const,
      config: typeof deployment.config === 'string' ? JSON.parse(deployment.config) : deployment.config,
    };

    return {
      deployment: updatedDeployment,
      historyId: history.id,
    };
  }
);

// Helper function to generate version string
function generateVersion(): string {
  const now = new Date();
  return `v${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
}

// Helper function to start deployment process (would integrate with actual deployment services)
async function startDeploymentProcess(deploymentId: string, historyId: string) {
  // This would integrate with actual deployment providers
  // For now, we'll simulate a deployment process
  setTimeout(async () => {
    const mockUrl = `https://${deploymentId}.app.example.com`;
    
    await deploymentDB.exec`
      UPDATE deployments 
      SET status = 'deployed', url = ${mockUrl}, last_deployed_at = NOW(), updated_at = NOW()
      WHERE id = ${deploymentId}
    `;

    await deploymentDB.exec`
      UPDATE deployment_history 
      SET status = 'deployed', url = ${mockUrl}
      WHERE id = ${historyId}
    `;
  }, 10000); // 10 second mock deployment
}