import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { deploymentDB } from "./db";
import { projectsDB } from "../projects/db";
import { Deployment, DeploymentStatus, CreateDeploymentRequest, DeploymentProvider } from "./types";

// Creates a new deployment for a project.
export const createDeployment = api<CreateDeploymentRequest, Deployment>(
  { auth: true, expose: true, method: "POST", path: "/deployment/deploy" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project exists and belongs to user
    const project = await projectsDB.queryRow`
      SELECT id, name, status FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    if (project.status !== 'ready') {
      throw APIError.invalidArgument("Project must be in ready state to deploy");
    }

    const deployment = await deploymentDB.queryRow<Deployment>`
      INSERT INTO deployments (project_id, name, provider, environment, configuration, status, user_id)
      VALUES (${req.projectId}, ${req.name}, ${req.provider}, ${req.environment}, ${JSON.stringify(req.configuration)}, 'pending', ${auth.userID})
      RETURNING 
        id,
        project_id as "projectId",
        name,
        provider,
        environment,
        configuration,
        status,
        url,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deployed_at as "deployedAt"
    `;

    if (!deployment) {
      throw APIError.internal("Failed to create deployment");
    }

    // Start deployment process
    startDeploymentProcess(deployment.id, req);

    // Update project status
    await projectsDB.exec`
      UPDATE projects 
      SET status = 'deploying', updated_at = NOW()
      WHERE id = ${req.projectId}
    `;

    return deployment;
  }
);

export interface GetDeploymentParams {
  id: string;
}

// Gets a deployment by ID.
export const getDeployment = api<GetDeploymentParams, Deployment>(
  { auth: true, expose: true, method: "GET", path: "/deployment/deployments/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const deployment = await deploymentDB.queryRow<Deployment>`
      SELECT 
        d.id,
        d.project_id as "projectId",
        d.name,
        d.provider,
        d.environment,
        d.configuration,
        d.status,
        d.url,
        d.build_logs as "buildLogs",
        d.deploy_logs as "deployLogs",
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        d.deployed_at as "deployedAt"
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = ${id} AND p.user_id = ${auth.userID}
    `;

    if (!deployment) {
      throw APIError.notFound("Deployment not found");
    }

    return deployment;
  }
);

export interface ListDeploymentsParams {
  projectId: string;
}

export interface ListDeploymentsResponse {
  deployments: Deployment[];
}

// Lists all deployments for a project.
export const listDeployments = api<ListDeploymentsParams, ListDeploymentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/deployment/deployments/project/:projectId" },
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

    const deployments = [];
    for await (const deployment of deploymentDB.query<Deployment>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        provider,
        environment,
        configuration,
        status,
        url,
        build_logs as "buildLogs",
        deploy_logs as "deployLogs",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deployed_at as "deployedAt"
      FROM deployments
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `) {
      deployments.push(deployment);
    }

    return { deployments };
  }
);

export interface GetProvidersResponse {
  providers: DeploymentProvider[];
}

// Lists all available deployment providers.
export const getProviders = api<void, GetProvidersResponse>(
  { auth: true, expose: true, method: "GET", path: "/deployment/providers" },
  async () => {
    return {
      providers: [
        {
          id: 'vercel',
          name: 'Vercel',
          description: 'Frontend deployment platform with edge computing',
          icon: 'vercel',
          supportedTypes: ['web', 'frontend'],
          features: ['Edge Functions', 'CDN', 'Analytics', 'Preview Deployments'],
          regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
        },
        {
          id: 'netlify',
          name: 'Netlify',
          description: 'Modern web development platform',
          icon: 'netlify',
          supportedTypes: ['web', 'frontend'],
          features: ['Forms', 'Functions', 'Identity', 'Split Testing'],
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
        },
        {
          id: 'aws',
          name: 'Amazon Web Services',
          description: 'Cloud computing platform',
          icon: 'aws',
          supportedTypes: ['web', 'backend', 'fullstack'],
          features: ['EC2', 'Lambda', 'RDS', 'S3', 'CloudFront'],
          regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'ap-northeast-1'],
        },
        {
          id: 'gcp',
          name: 'Google Cloud Platform',
          description: 'Google\'s cloud computing services',
          icon: 'gcp',
          supportedTypes: ['web', 'backend', 'fullstack'],
          features: ['Compute Engine', 'Cloud Functions', 'Cloud SQL', 'Cloud Storage'],
          regions: ['us-central1', 'us-east1', 'europe-west1', 'asia-southeast1'],
        },
        {
          id: 'railway',
          name: 'Railway',
          description: 'Modern app hosting platform',
          icon: 'railway',
          supportedTypes: ['backend', 'fullstack'],
          features: ['Databases', 'One-click deploys', 'GitHub integration'],
          regions: ['us-west-2', 'eu-west-1'],
        },
        {
          id: 'render',
          name: 'Render',
          description: 'Cloud platform for developers',
          icon: 'render',
          supportedTypes: ['web', 'backend', 'fullstack'],
          features: ['Auto-deploy', 'SSL', 'Database hosting', 'Background jobs'],
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
        },
      ],
    };
  }
);

async function startDeploymentProcess(deploymentId: string, req: CreateDeploymentRequest) {
  // Simulate deployment process
  setTimeout(async () => {
    // Building phase
    await updateDeploymentStatus(deploymentId, 'building', 'Building application...');
    
    setTimeout(async () => {
      // Deploying phase
      await updateDeploymentStatus(deploymentId, 'deploying', 'Deploying to ' + req.provider);
      
      setTimeout(async () => {
        // Success
        const url = generateDeploymentUrl(req.provider, req.name);
        await updateDeploymentStatus(deploymentId, 'deployed', 'Deployment completed successfully', url);
        
        // Update project with deploy URL
        await projectsDB.exec`
          UPDATE projects 
          SET status = 'deployed', deploy_url = ${url}, updated_at = NOW()
          WHERE id = ${req.projectId}
        `;
      }, 15000);
    }, 20000);
  }, 10000);
}

async function updateDeploymentStatus(deploymentId: string, status: DeploymentStatus, message: string, url?: string) {
  const updateFields = ['status = $1', 'updated_at = NOW()'];
  const params = [status];
  
  if (url) {
    updateFields.push('url = $2', 'deployed_at = NOW()');
    params.push(url);
  }
  
  const query = `
    UPDATE deployments 
    SET ${updateFields.join(', ')}
    WHERE id = $${params.length + 1}
  `;
  params.push(deploymentId);
  
  await deploymentDB.rawExec(query, ...params);
}

function generateDeploymentUrl(provider: string, name: string): string {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const randomId = Math.random().toString(36).substring(2, 8);
  
  switch (provider) {
    case 'vercel':
      return `https://${cleanName}-${randomId}.vercel.app`;
    case 'netlify':
      return `https://${cleanName}-${randomId}.netlify.app`;
    case 'railway':
      return `https://${cleanName}-${randomId}.railway.app`;
    case 'render':
      return `https://${cleanName}-${randomId}.onrender.com`;
    default:
      return `https://${cleanName}-${randomId}.example.com`;
  }
}