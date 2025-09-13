export interface ExecutionEnvironment {
  id: string;
  name: string;
  runtime: 'node' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'ruby' | 'dotnet';
  version: string;
  image: string;
  status: 'creating' | 'running' | 'stopped' | 'failed' | 'terminated';
  projectId: string;
  containerId?: string;
  ports: Record<string, number>;
  environment: Record<string, string>;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  createdAt: Date;
  lastUsedAt: Date;
}

export interface ExecutionRequest {
  projectId: string;
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  runtime?: 'node' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'ruby' | 'dotnet';
}

export interface ExecutionResult {
  id: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  startedAt: Date;
  completedAt: Date;
  environment: string;
}

export interface CreateEnvironmentRequest {
  projectId: string;
  runtime: 'node' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'ruby' | 'dotnet';
  version?: string;
  name?: string;
  environment?: Record<string, string>;
  resources?: {
    cpu?: number;
    memory?: number;
    storage?: number;
  };
}

export interface TerminalSession {
  id: string;
  environmentId: string;
  projectId: string;
  status: 'active' | 'closed';
  createdAt: Date;
  lastActivityAt: Date;
}

export interface TerminalMessage {
  sessionId: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

export interface PackageManagerOperation {
  projectId: string;
  manager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'maven' | 'gradle' | 'cargo' | 'composer' | 'gem';
  operation: 'install' | 'uninstall' | 'update' | 'list' | 'audit';
  packages?: string[];
  options?: Record<string, any>;
}