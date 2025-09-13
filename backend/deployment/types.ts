export interface DeploymentProvider {
  id: string;
  name: string;
  displayName: string;
  type: ProviderType;
  configSchema: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
}

export type ProviderType = 'static' | 'container' | 'serverless' | 'edge';

export interface Deployment {
  id: string;
  projectId: string;
  providerId: string;
  name: string;
  environment: string;
  status: DeploymentStatus;
  config: Record<string, any>;
  buildLogs?: string;
  deployLogs?: string;
  url?: string;
  lastDeployedAt?: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DeploymentStatus = 
  | 'pending'
  | 'building'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'cancelled';

export interface DeploymentHistory {
  id: string;
  deploymentId: string;
  version: string;
  status: DeploymentStatus;
  commitSha?: string;
  buildLogs?: string;
  deployLogs?: string;
  url?: string;
  deployedBy: string;
  deployedAt: Date;
  rollbackTo?: string;
}

export interface DeploymentConfig {
  buildCommand?: string;
  outputDirectory?: string;
  environmentVariables?: Record<string, string>;
  customDomain?: string;
  redirects?: Redirect[];
  headers?: Header[];
}

export interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export interface Header {
  source: string;
  headers: Record<string, string>;
}