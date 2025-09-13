export interface AgentSession {
  id: string;
  projectId: string;
  userId: string;
  type: SessionType;
  status: SessionStatus;
  request: Record<string, any>;
  response?: Record<string, any>;
  progress: SessionProgress;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export type SessionType = 
  | 'project_generation'
  | 'code_review'
  | 'optimization'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'deployment'
  | 'security_scan';

export type SessionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SessionProgress {
  totalTasks: number;
  completedTasks: number;
  currentAgent?: string;
  currentTask?: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface AgentTask {
  id: string;
  sessionId: string;
  agentName: string;
  taskType: string;
  status: TaskStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  dependencies: string[];
  progress: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export type TaskStatus = 
  | 'pending'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentLog {
  id: string;
  sessionId: string;
  taskId?: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentArtifact {
  id: string;
  sessionId: string;
  taskId?: string;
  name: string;
  type: ArtifactType;
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export type ArtifactType = 
  | 'file'
  | 'documentation'
  | 'test'
  | 'config'
  | 'script'
  | 'report'
  | 'diagram';

export interface Agent {
  name: string;
  displayName: string;
  description: string;
  capabilities: string[];
  supportedTaskTypes: string[];
  dependencies: string[];
  estimatedDuration: number; // in seconds
}

export interface ProjectGenerationRequest {
  description: string;
  requirements: string[];
  constraints?: string[];
  targetFrameworks?: string[];
  features?: string[];
  preferences?: Record<string, any>;
}