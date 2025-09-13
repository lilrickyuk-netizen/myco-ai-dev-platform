export interface OrchestrationRequest {
  projectId: string;
  requirements: {
    description: string;
    features: string[];
    constraints?: string[];
    performance?: string[];
    security?: string[];
  };
  techStack: {
    frontend?: string;
    backend?: string;
    database?: string;
    deployment?: string;
    language?: string;
    framework?: string;
  };
  configuration?: {
    environment?: string;
    resources?: Record<string, any>;
    scaling?: Record<string, any>;
  };
}

export interface OrchestrationResponse {
  orchestrationId: string;
  status: AgentTaskStatus;
  message: string;
  estimatedCompletionTime: Date;
}

export interface OrchestrationStatus {
  orchestrationId: string;
  projectId: string;
  projectName?: string;
  status: AgentTaskStatus;
  statusMessage?: string;
  progressPercentage?: number;
  currentPhase?: string;
  estimatedCompletion?: Date;
  createdAt: Date;
  updatedAt: Date;
  activeTasks?: AgentTask[];
}

export interface AgentTask {
  id: string;
  agentType: string;
  taskType: string;
  description: string;
  status: AgentTaskStatus;
  progressPercentage?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export type AgentTaskStatus = 
  | 'initializing'
  | 'planning'
  | 'architecture'
  | 'development'
  | 'integration'
  | 'testing'
  | 'security'
  | 'deployment'
  | 'verification'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentSession {
  id: string;
  projectId: string;
  userId: string;
  status: AgentSessionStatus;
  agents: Agent[];
  tasks: AgentTask[];
  startedAt: Date;
  completedAt?: Date;
  configuration: Record<string, any>;
  results?: Record<string, any>;
}

export type AgentSessionStatus = 
  | 'created'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  currentTask?: string;
  completedTasks: string[];
  performance: {
    successRate: number;
    averageTime: number;
    totalTasks: number;
  };
}

export type AgentType = 
  | 'orchestrator'
  | 'planner'
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'infrastructure'
  | 'security'
  | 'testing'
  | 'deployment'
  | 'verification';

export type AgentStatus = 
  | 'idle'
  | 'working'
  | 'completed'
  | 'error';

export interface ProjectGenerationRequest {
  name: string;
  description: string;
  templateType: string;
  templateName: string;
  requirements: {
    features: string[];
    constraints?: string[];
    performance?: string[];
    security?: string[];
  };
  techStack: {
    frontend?: string;
    backend?: string;
    database?: string;
    deployment?: string;
  };
}