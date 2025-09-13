// Deployment environments and configurations
export interface DeploymentEnvironment {
  id: string;
  name: string;
  type: 'development' | 'staging' | 'production';
  projectId: string;
  provider: 'aws' | 'gcp' | 'azure' | 'vercel' | 'netlify' | 'digitalocean' | 'heroku';
  region: string;
  status: 'active' | 'inactive' | 'deploying' | 'failed';
  config: Record<string, any>;
  domainName?: string;
  subdomain?: string;
  customDomain?: string;
  sslEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentHistory {
  id: string;
  environmentId: string;
  projectId: string;
  version: string;
  commitHash?: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  logs: string[];
  buildTime?: number;
  deployTime?: number;
  startedAt: Date;
  completedAt?: Date;
  deployedBy: string;
  rollbackTarget?: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  type: 'development' | 'staging' | 'production';
  projectId: string;
  provider: 'aws' | 'gcp' | 'azure' | 'vercel' | 'netlify' | 'digitalocean' | 'heroku';
  region: string;
  config: Record<string, any>;
  domainName?: string;
  customDomain?: string;
}

export interface DeployRequest {
  environmentId: string;
  commitHash?: string;
  buildConfig?: Record<string, any>;
  envVars?: Record<string, string>;
}

export interface RollbackRequest {
  environmentId: string;
  targetDeploymentId: string;
}

export interface EnvironmentMetrics {
  environmentId: string;
  cpu: number;
  memory: number;
  storage: number;
  bandwidth: number;
  requests: number;
  errors: number;
  uptime: number;
  timestamp: Date;
}