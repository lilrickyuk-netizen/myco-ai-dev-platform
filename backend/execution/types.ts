export interface ExecutionEnvironment {
  id: string;
  projectId: string;
  name: string;
  runtime: string;
  version: string;
  status: EnvironmentStatus;
  containerId?: string;
  port?: number;
  cpuLimit: string;
  memoryLimit: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EnvironmentStatus = 
  | 'creating'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'error'
  | 'destroyed';

export interface ExecutionSession {
  id: string;
  environmentId: string;
  command: string;
  status: SessionStatus;
  exitCode?: number;
  output?: string;
  errorOutput?: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
}

export type SessionStatus = 
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionLog {
  id: string;
  sessionId: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: LogSource;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'stdout' | 'stderr' | 'system';

export interface Runtime {
  name: string;
  displayName: string;
  versions: string[];
  dockerImage: string;
  defaultCommand: string;
  packageManager?: string;
  installCommand?: string;
  runCommand?: string;
  buildCommand?: string;
  extensions: string[];
}