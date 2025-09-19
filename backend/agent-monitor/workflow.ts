import { api } from "encore.dev/api";
import db from "../db";
import { WorkflowStatus, AgentStatus, WorkflowPhase, AgentDependencyGraph } from "./types";

interface CreateWorkflowRequest {
  projectId: string;
  phases: {
    name: string;
    description: string;
    estimatedDuration: number;
    agents: {
      name: string;
      type: AgentStatus["type"];
      dependencies?: string[];
    }[];
  }[];
}

interface CreateWorkflowResponse {
  workflowId: string;
}

// Create a new workflow with agents and dependencies
export const createWorkflow = api<CreateWorkflowRequest, CreateWorkflowResponse>(
  { expose: true, method: "POST", path: "/agent-monitor/workflows", auth: true },
  async (req): Promise<CreateWorkflowResponse> => {
    const transaction = await db.begin();
    try {
      // Create workflow
      const workflow = await transaction.queryAll`
        INSERT INTO workflows (project_id, current_phase)
        VALUES (${req.projectId}, ${req.phases[0]?.name || 'Planning'})
        RETURNING id
      `;
      const workflowId = workflow[0].id;

      // Create phases
      const phaseMap = new Map<string, string>();
      for (let i = 0; i < req.phases.length; i++) {
        const phase = req.phases[i];
        const phaseResult = await transaction.queryAll`
          INSERT INTO workflow_phases (
            workflow_id, name, description, estimated_duration, phase_order
          )
          VALUES (${workflowId}, ${phase.name}, ${phase.description}, ${phase.estimatedDuration}, ${i})
          RETURNING id
        `;
        phaseMap.set(phase.name, phaseResult[0].id);
      }

      // Create agents
      const agentMap = new Map<string, string>();
      for (const phase of req.phases) {
        const phaseId = phaseMap.get(phase.name);
        
        for (const agent of phase.agents) {
          const agentResult = await transaction.queryAll`
            INSERT INTO agents (workflow_id, phase_id, name, type)
            VALUES (${workflowId}, ${phaseId}, ${agent.name}, ${agent.type})
            RETURNING id
          `;
          agentMap.set(agent.name, agentResult[0].id);
        }
      }

      // Create dependencies
      for (const phase of req.phases) {
        for (const agent of phase.agents) {
          const agentId = agentMap.get(agent.name);
          if (agent.dependencies) {
            for (const depName of agent.dependencies) {
              const depAgentId = agentMap.get(depName);
              if (depAgentId) {
                await transaction.exec`
                  INSERT INTO agent_dependencies (agent_id, depends_on_agent_id)
                  VALUES (${agentId}, ${depAgentId})
                `;
              }
            }
          }
        }
      }

      await transaction.commit();
      return { workflowId };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
);

interface GetWorkflowRequest {
  workflowId: string;
}

// Get detailed workflow information
export const getWorkflow = api<GetWorkflowRequest, WorkflowStatus>(
  { expose: true, method: "GET", path: "/agent-monitor/workflows/:workflowId", auth: true },
  async (req): Promise<WorkflowStatus> => {
    const workflow = await db.query`
      SELECT 
        id, project_id, status, progress, started_at, 
        estimated_completion_time, completed_at, current_phase
      FROM workflows 
      WHERE id = ${req.workflowId}
    `;

    if (workflow.length === 0) {
      throw new Error(`Workflow ${req.workflowId} not found`);
    }

    const w = workflow[0];

    // Get agents
    const agents = await db.query`
      SELECT 
        a.id, a.name, a.type, a.status, a.progress, a.started_at, 
        a.completed_at, a.estimated_completion_time, a.error_message, a.outputs,
        COALESCE(
          ARRAY_AGG(ad.depends_on_agent_id) FILTER (WHERE ad.depends_on_agent_id IS NOT NULL),
          ARRAY[]::UUID[]
        ) as dependencies
      FROM agents a
      LEFT JOIN agent_dependencies ad ON a.id = ad.agent_id
      WHERE a.workflow_id = ${req.workflowId}
      GROUP BY a.id, a.name, a.type, a.status, a.progress, a.started_at, a.completed_at, a.estimated_completion_time, a.error_message, a.outputs
      ORDER BY a.created_at
    `;

    // Get phases
    const phases = await db.query`
      SELECT 
        wp.id, wp.name, wp.description, wp.status, wp.progress, 
        wp.estimated_duration, wp.actual_duration,
        COALESCE(
          ARRAY_AGG(a.id) FILTER (WHERE a.id IS NOT NULL),
          ARRAY[]::UUID[]
        ) as agent_ids
      FROM workflow_phases wp
      LEFT JOIN agents a ON wp.id = a.phase_id
      WHERE wp.workflow_id = ${req.workflowId}
      GROUP BY wp.id, wp.name, wp.description, wp.status, wp.progress, wp.estimated_duration, wp.actual_duration, wp.phase_order
      ORDER BY wp.phase_order
    `;

    return {
      id: w.id,
      projectId: w.project_id,
      status: w.status,
      progress: w.progress,
      startedAt: w.started_at,
      estimatedCompletionTime: w.estimated_completion_time,
      completedAt: w.completed_at,
      currentPhase: w.current_phase,
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        progress: agent.progress,
        startedAt: agent.started_at,
        completedAt: agent.completed_at,
        estimatedCompletionTime: agent.estimated_completion_time,
        error: agent.error_message,
        dependencies: agent.dependencies || [],
        outputs: agent.outputs
      })),
      phases: phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        status: phase.status,
        progress: phase.progress,
        estimatedDuration: phase.estimated_duration,
        actualDuration: phase.actual_duration,
        agents: phase.agent_ids || []
      }))
    };
  }
);

// Get dependency graph for workflow visualization
export const getDependencyGraph = api<GetWorkflowRequest, AgentDependencyGraph>(
  { expose: true, method: "GET", path: "/agent-monitor/workflows/:workflowId/graph", auth: true },
  async (req): Promise<AgentDependencyGraph> => {
    const agents = await db.query`
      SELECT id, name, type, status, progress
      FROM agents
      WHERE workflow_id = ${req.workflowId}
      ORDER BY created_at
    `;

    const dependencies = await db.query`
      SELECT agent_id as from_agent, depends_on_agent_id as to_agent
      FROM agent_dependencies ad
      WHERE EXISTS (
        SELECT 1 FROM agents a WHERE a.id = ad.agent_id AND a.workflow_id = ${req.workflowId}
      )
    `;

    return {
      nodes: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        progress: agent.progress
      })),
      edges: dependencies.map(dep => ({
        from: dep.to_agent, // Dependency flows from dependency to dependent
        to: dep.from_agent,
        type: "dependency" as const
      }))
    };
  }
);

interface StartWorkflowRequest {
  workflowId: string;
}

// Start a workflow execution
export const startWorkflow = api<StartWorkflowRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/agent-monitor/workflows/:workflowId/start", auth: true },
  async (req): Promise<{ success: boolean }> => {
    await db.exec`
      UPDATE workflows 
      SET status = 'running', started_at = NOW()
      WHERE id = ${req.workflowId} AND status = 'pending'
    `;

    // Start first phase agents that have no dependencies
    await db.exec`
      UPDATE agents 
      SET status = 'running', started_at = NOW()
      WHERE workflow_id = ${req.workflowId} 
      AND id NOT IN (
        SELECT agent_id FROM agent_dependencies
        WHERE agent_id IN (
          SELECT id FROM agents WHERE workflow_id = ${req.workflowId}
        )
      )
    `;

    return { success: true };
  }
);