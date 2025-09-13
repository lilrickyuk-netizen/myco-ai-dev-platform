export interface AIGenerationRequest {
  prompt: string;
  context?: string;
  type: 'code' | 'file' | 'project' | 'explanation' | 'refactor';
  language?: string;
  framework?: string;
}

export interface AIGenerationResponse {
  content: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  output?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
