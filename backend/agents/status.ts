import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { AgentTask } from "./types";

interface GetTaskStatusRequest {
  taskId: string;
}

interface GetTaskStatusResponse {
  workflow: {
    id: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
  };
  tasks: AgentTask[];
  progress: number;
}

// Gets the status of an orchestrated task.
export const getTaskStatus = api<GetTaskStatusRequest, GetTaskStatusResponse>(
  { auth: true, expose: true, method: "GET", path: "/agents/tasks/:taskId/status" },
  async (req) => {
    const auth = getAuthData()!;
    
    const workflow = await agentsDB.queryRow<{
      id: string;
      status: string;
      createdAt: Date;
      completedAt?: Date;
    }>`
      SELECT id, status, created_at as "createdAt", completed_at as "completedAt"
      FROM agent_workflows
      WHERE id = ${req.taskId}
    `;

    if (!workflow) {
      throw new Error("Task not found");
    }

    const tasks: AgentTask[] = [];
    for await (const row of agentsDB.query<AgentTask>`
      SELECT 
        id,
        type,
        status,
        project_id as "projectId",
        input,
        output,
        error,
        agent_id as "agentId",
        created_at as "createdAt",
        completed_at as "completedAt"
      FROM agent_tasks
      WHERE input->>'workflowId' = ${req.taskId}
      ORDER BY created_at ASC
    `) {
      tasks.push(row);
    }

    // Calculate progress
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    return {
      workflow,
      tasks,
      progress,
    };
  }
);
