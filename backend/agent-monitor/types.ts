export interface AgentStatus {
  id: string;
  name: string;
  type: "planner" | "backend" | "frontend" | "architecture" | "validation" | "orchestrator";
  status: "pending" | "running" | "completed" | "failed" | "paused";
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;
  error?: string;
  dependencies: string[]; // Agent IDs this agent depends on
  outputs?: Record<string, any>;
}

export interface WorkflowStatus {
  id: string;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  progress: number; // 0-100
  startedAt: Date;
  estimatedCompletionTime?: Date;
  completedAt?: Date;
  agents: AgentStatus[];
  currentPhase: string;
  phases: WorkflowPhase[];
}

export interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  estimatedDuration: number; // in seconds
  actualDuration?: number;
  agents: string[]; // Agent IDs in this phase
}

export interface AgentProgressUpdate {
  workflowId: string;
  agentId: string;
  progress: number;
  status: AgentStatus["status"];
  message?: string;
  estimatedCompletionTime?: Date;
  outputs?: Record<string, any>;
  error?: string;
}

export interface AgentDependencyGraph {
  nodes: {
    id: string;
    name: string;
    type: AgentStatus["type"];
    status: AgentStatus["status"];
    progress: number;
  }[];
  edges: {
    from: string;
    to: string;
    type: "dependency" | "data-flow";
  }[];
}

export interface SystemMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  avgCompletionTime: number;
  systemLoad: number;
  agentUtilization: Record<string, number>;
}

export interface DashboardState {
  workflows: WorkflowStatus[];
  systemMetrics: SystemMetrics;
  recentActivity: AgentProgressUpdate[];
}