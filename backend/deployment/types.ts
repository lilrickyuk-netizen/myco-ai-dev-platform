export interface Deployment {
  id: string;
  projectId: string;
  name: string;
  provider: string;
  environment: string;
  configuration: Record<string, any>;
  status: DeploymentStatus;
  url?: string;
  buildLogs?: string;
  deployLogs?: string;
  createdAt: Date;
  updatedAt: Date;
  deployedAt?: Date;
}

export type DeploymentStatus = 
  | 'pending'
  | 'building'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'cancelled';

export interface CreateDeploymentRequest {
  projectId: string;
  name: string;
  provider: string;
  environment: string;
  configuration: {
    region?: string;
    instanceType?: string;
    scaling?: {
      min: number;
      max: number;
    };
    environment?: Record<string, string>;
    domains?: string[];
    ssl?: boolean;
  };
}

export interface DeploymentProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  supportedTypes: string[];
  features: string[];
  regions: string[];
}