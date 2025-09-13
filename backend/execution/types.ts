export interface Environment {
  id: string;
  projectId: string;
  name: string;
  type: EnvironmentType;
  configuration: Record<string, any>;
  status: EnvironmentStatus;
  containerId?: string;
  port?: number;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EnvironmentType = 
  | 'nodejs'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'docker'
  | 'custom';

export type EnvironmentStatus = 
  | 'creating'
  | 'running'
  | 'stopped'
  | 'error'
  | 'deleting';

export interface CreateEnvironmentRequest {
  projectId: string;
  name: string;
  type: EnvironmentType;
  configuration: {
    image?: string;
    runtime?: string;
    version?: string;
    memory?: string;
    cpu?: number;
    environment?: Record<string, string>;
    volumes?: Array<{ host: string; container: string }>;
    ports?: Array<{ host: number; container: number }>;
  };
}

export interface ExecutionResult {
  output: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsageMB: number;
  error?: string;
}