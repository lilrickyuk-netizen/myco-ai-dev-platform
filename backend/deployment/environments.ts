import { api } from "encore.dev/api";
import { DB } from "./db";
import type { 
  DeploymentEnvironment, 
  CreateEnvironmentRequest, 
  DeployRequest,
  RollbackRequest,
  EnvironmentMetrics 
} from "./types";

export const createEnvironment = api(
  { method: "POST", path: "/environments", expose: true },
  async (req: CreateEnvironmentRequest): Promise<DeploymentEnvironment> => {
    const result = await DB.exec`
      INSERT INTO deployment_environments (
        name, type, project_id, provider, region, config, domain_name, custom_domain
      ) VALUES (
        ${req.name}, ${req.type}, ${req.projectId}, ${req.provider}, 
        ${req.region}, ${JSON.stringify(req.config)}, ${req.domainName || null}, 
        ${req.customDomain || null}
      )
      RETURNING *
    `;

    const env = result.rows[0];
    return {
      id: env.id,
      name: env.name,
      type: env.type,
      projectId: env.project_id,
      provider: env.provider,
      region: env.region,
      status: env.status,
      config: JSON.parse(env.config),
      domainName: env.domain_name,
      subdomain: env.subdomain,
      customDomain: env.custom_domain,
      sslEnabled: env.ssl_enabled,
      createdAt: env.created_at,
      updatedAt: env.updated_at,
    };
  }
);

export const listEnvironments = api(
  { method: "GET", path: "/environments/:projectId", expose: true },
  async ({ projectId }: { projectId: string }): Promise<{ environments: DeploymentEnvironment[] }> => {
    const result = await DB.exec`
      SELECT * FROM deployment_environments 
      WHERE project_id = ${projectId}
      ORDER BY created_at ASC
    `;

    const environments = result.rows.map(env => ({
      id: env.id,
      name: env.name,
      type: env.type,
      projectId: env.project_id,
      provider: env.provider,
      region: env.region,
      status: env.status,
      config: JSON.parse(env.config),
      domainName: env.domain_name,
      subdomain: env.subdomain,
      customDomain: env.custom_domain,
      sslEnabled: env.ssl_enabled,
      createdAt: env.created_at,
      updatedAt: env.updated_at,
    }));

    return { environments };
  }
);

export const deploy = api(
  { method: "POST", path: "/deploy", expose: true },
  async (req: DeployRequest): Promise<{ deploymentId: string; status: string }> => {
    // Get environment details
    const envResult = await DB.exec`
      SELECT * FROM deployment_environments WHERE id = ${req.environmentId}
    `;
    
    if (envResult.rows.length === 0) {
      throw new Error("Environment not found");
    }

    const environment = envResult.rows[0];

    // Create deployment record
    const deployResult = await DB.exec`
      INSERT INTO deployment_history (
        environment_id, project_id, version, commit_hash, deployed_by
      ) VALUES (
        ${req.environmentId}, ${environment.project_id}, 
        ${new Date().toISOString()}, ${req.commitHash || null}, 
        ${"current-user"} -- TODO: Get from auth context
      )
      RETURNING id
    `;

    const deploymentId = deployResult.rows[0].id;

    // Update environment status
    await DB.exec`
      UPDATE deployment_environments 
      SET status = 'deploying', updated_at = NOW()
      WHERE id = ${req.environmentId}
    `;

    // TODO: Trigger actual deployment process
    // This would integrate with the deployment engine
    
    return {
      deploymentId,
      status: "deploying"
    };
  }
);

export const rollback = api(
  { method: "POST", path: "/rollback", expose: true },
  async (req: RollbackRequest): Promise<{ success: boolean }> => {
    // Get target deployment
    const targetResult = await DB.exec`
      SELECT * FROM deployment_history WHERE id = ${req.targetDeploymentId}
    `;

    if (targetResult.rows.length === 0) {
      throw new Error("Target deployment not found");
    }

    // Create rollback deployment record
    await DB.exec`
      INSERT INTO deployment_history (
        environment_id, project_id, version, status, deployed_by, rollback_target
      ) VALUES (
        ${req.environmentId}, ${targetResult.rows[0].project_id},
        ${targetResult.rows[0].version}, 'pending',
        ${"current-user"}, ${req.targetDeploymentId}
      )
    `;

    // TODO: Trigger actual rollback process

    return { success: true };
  }
);

export const getEnvironmentMetrics = api(
  { method: "GET", path: "/environments/:environmentId/metrics", expose: true },
  async ({ environmentId }: { environmentId: string }): Promise<{ metrics: EnvironmentMetrics[] }> => {
    const result = await DB.exec`
      SELECT * FROM environment_metrics 
      WHERE environment_id = ${environmentId}
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const metrics = result.rows.map(metric => ({
      environmentId: metric.environment_id,
      cpu: parseFloat(metric.cpu),
      memory: parseFloat(metric.memory),
      storage: parseFloat(metric.storage),
      bandwidth: parseFloat(metric.bandwidth),
      requests: metric.requests,
      errors: metric.errors,
      uptime: parseFloat(metric.uptime),
      timestamp: metric.timestamp,
    }));

    return { metrics };
  }
);