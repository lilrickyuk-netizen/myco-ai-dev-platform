import { api, StreamOut } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { AgentProgressUpdate, WorkflowStatus, DashboardState, SystemMetrics } from "./types";

const db = new SQLDatabase("agent_monitor", { migrations: "./db/migrations" });

// Store active WebSocket connections for broadcasting
const activeStreams = new Set<StreamOut<AgentProgressUpdate>>();

// Real-time progress stream for agent updates
export const progressStream = api.streamOut<{ workflowId?: string }, AgentProgressUpdate>(
  { expose: true, path: "/agent-monitor/progress", auth: true },
  async (handshake, stream) => {
    activeStreams.add(stream);
    
    try {
      // Keep the connection alive
      const keepAlive = setInterval(() => {
        // Send heartbeat if no recent updates
      }, 30000);

      // Wait for the client to disconnect
      await new Promise<void>((resolve) => {
        stream.onClose = resolve;
      });

      clearInterval(keepAlive);
    } finally {
      activeStreams.delete(stream);
    }
  }
);

// Get current dashboard state
export const getDashboardState = api<void, DashboardState>(
  { expose: true, method: "GET", path: "/agent-monitor/dashboard", auth: true },
  async (): Promise<DashboardState> => {
    // Get active workflows
    const workflows = await db.query`
      SELECT 
        w.id,
        w.project_id,
        w.status,
        w.progress,
        w.started_at,
        w.estimated_completion_time,
        w.completed_at,
        w.current_phase
      FROM workflows w
      WHERE w.status IN ('running', 'pending')
      ORDER BY w.started_at DESC
      LIMIT 20
    `;

    const workflowStatuses: WorkflowStatus[] = [];
    
    for (const workflow of workflows) {
      // Get agents for this workflow
      const agents = await db.query`
        SELECT 
          a.id,
          a.name,
          a.type,
          a.status,
          a.progress,
          a.started_at,
          a.completed_at,
          a.estimated_completion_time,
          a.error_message,
          a.outputs,
          COALESCE(
            ARRAY_AGG(ad.depends_on_agent_id) FILTER (WHERE ad.depends_on_agent_id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as dependencies
        FROM agents a
        LEFT JOIN agent_dependencies ad ON a.id = ad.agent_id
        WHERE a.workflow_id = ${workflow.id}
        GROUP BY a.id, a.name, a.type, a.status, a.progress, a.started_at, a.completed_at, a.estimated_completion_time, a.error_message, a.outputs
        ORDER BY a.created_at
      `;

      // Get phases for this workflow
      const phases = await db.query`
        SELECT 
          wp.id,
          wp.name,
          wp.description,
          wp.status,
          wp.progress,
          wp.estimated_duration,
          wp.actual_duration,
          COALESCE(
            ARRAY_AGG(a.id) FILTER (WHERE a.id IS NOT NULL),
            ARRAY[]::UUID[]
          ) as agent_ids
        FROM workflow_phases wp
        LEFT JOIN agents a ON wp.id = a.phase_id
        WHERE wp.workflow_id = ${workflow.id}
        GROUP BY wp.id, wp.name, wp.description, wp.status, wp.progress, wp.estimated_duration, wp.actual_duration, wp.phase_order
        ORDER BY wp.phase_order
      `;

      workflowStatuses.push({
        id: workflow.id,
        projectId: workflow.project_id,
        status: workflow.status,
        progress: workflow.progress,
        startedAt: workflow.started_at,
        estimatedCompletionTime: workflow.estimated_completion_time,
        completedAt: workflow.completed_at,
        currentPhase: workflow.current_phase,
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
      });
    }

    // Calculate system metrics
    const metricsResult = await db.query`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('running', 'pending')) as active_workflows,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_workflows,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_workflows,
        COUNT(*) as total_workflows,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_completion_time
      FROM workflows
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const agentUtilization = await db.query`
      SELECT 
        type,
        COUNT(*) FILTER (WHERE status = 'running') as running_count,
        COUNT(*) as total_count
      FROM agents
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY type
    `;

    const systemMetrics: SystemMetrics = {
      totalWorkflows: metricsResult[0]?.total_workflows || 0,
      activeWorkflows: metricsResult[0]?.active_workflows || 0,
      completedWorkflows: metricsResult[0]?.completed_workflows || 0,
      failedWorkflows: metricsResult[0]?.failed_workflows || 0,
      avgCompletionTime: metricsResult[0]?.avg_completion_time || 0,
      systemLoad: Math.random() * 100, // TODO: Calculate actual system load
      agentUtilization: agentUtilization.reduce((acc, row) => {
        acc[row.type] = row.total_count > 0 ? (row.running_count / row.total_count) * 100 : 0;
        return acc;
      }, {} as Record<string, number>)
    };

    // Get recent activity
    const recentActivity = await db.query`
      SELECT 
        apu.workflow_id,
        apu.agent_id,
        apu.progress,
        apu.status,
        apu.message,
        apu.estimated_completion_time,
        apu.outputs,
        apu.error_message,
        apu.created_at
      FROM agent_progress_updates apu
      ORDER BY apu.created_at DESC
      LIMIT 50
    `;

    return {
      workflows: workflowStatuses,
      systemMetrics,
      recentActivity: recentActivity.map(update => ({
        workflowId: update.workflow_id,
        agentId: update.agent_id,
        progress: update.progress,
        status: update.status,
        message: update.message,
        estimatedCompletionTime: update.estimated_completion_time,
        outputs: update.outputs,
        error: update.error_message
      }))
    };
  }
);

// Broadcast progress update to all connected clients
export async function broadcastProgressUpdate(update: AgentProgressUpdate): Promise<void> {
  // Store the update in database
  await db.exec`
    INSERT INTO agent_progress_updates (
      workflow_id, agent_id, progress, status, message, 
      estimated_completion_time, outputs, error_message
    )
    VALUES (
      ${update.workflowId}, ${update.agentId}, ${update.progress}, 
      ${update.status}, ${update.message}, ${update.estimatedCompletionTime}, 
      ${JSON.stringify(update.outputs)}, ${update.error}
    )
  `;

  // Update the agent record
  await db.exec`
    UPDATE agents 
    SET 
      progress = ${update.progress},
      status = ${update.status},
      estimated_completion_time = ${update.estimatedCompletionTime},
      error_message = ${update.error},
      outputs = ${JSON.stringify(update.outputs)},
      completed_at = CASE WHEN ${update.status} = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = ${update.agentId}
  `;

  // Broadcast to all connected clients
  const deadStreams: StreamOut<AgentProgressUpdate>[] = [];
  
  for (const stream of activeStreams) {
    try {
      await stream.send(update);
    } catch (error) {
      // Mark stream for removal if it's dead
      deadStreams.push(stream);
    }
  }

  // Clean up dead streams
  deadStreams.forEach(stream => activeStreams.delete(stream));
}