export interface AgentTask {
  id: string;
  type: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  projectId: string;
  input: any;
  output?: any;
  error?: string;
  agentId: string;
  createdAt: Date;
  completedAt?: Date;
}

export type AgentType = 
  | 'architecture'
  | 'backend'
  | 'frontend'
  | 'infrastructure'
  | 'security'
  | 'verification'
  | 'deployment';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  status: 'idle' | 'busy';
}

export interface OrchestrationRequest {
  projectId: string;
  task: string;
  requirements: string[];
  agents?: AgentType[];
}

export interface OrchestrationResponse {
  taskId: string;
  agents: Agent[];
  estimatedDuration: number;
}
