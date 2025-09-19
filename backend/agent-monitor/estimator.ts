import { SQLDatabase } from "encore.dev/storage/sqldb";
import { AgentStatus, WorkflowPhase } from "./types";

const db = new SQLDatabase("agent_monitor", { migrations: "./db/migrations" });

interface EstimationData {
  agentType: string;
  avgDuration: number;
  completionRate: number;
  varianceScore: number;
}

interface ProgressPoint {
  progress: number;
  timestamp: Date;
}

export class CompletionTimeEstimator {
  private static estimationCache = new Map<string, EstimationData>();
  private static lastCacheUpdate = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static async estimateAgentCompletion(
    agentId: string,
    agentType: string,
    currentProgress: number
  ): Promise<Date | null> {
    if (currentProgress >= 100) return new Date();

    try {
      // Get historical data for this agent type
      const estimationData = await this.getEstimationData(agentType);
      
      // Get recent progress points for this specific agent
      const progressHistory = await this.getAgentProgressHistory(agentId, 10);
      
      if (progressHistory.length < 2) {
        // Fallback to average duration for agent type
        const avgDuration = estimationData.avgDuration || 600; // 10 minutes default
        const remainingProgress = 100 - currentProgress;
        const estimatedSeconds = (avgDuration * remainingProgress) / 100;
        return new Date(Date.now() + estimatedSeconds * 1000);
      }

      // Calculate velocity based on recent progress
      const velocity = this.calculateVelocity(progressHistory);
      
      if (velocity <= 0) {
        // Agent is stuck or moving backward, use fallback
        return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes fallback
      }

      const remainingProgress = 100 - currentProgress;
      const estimatedSeconds = remainingProgress / velocity;
      
      // Apply variance adjustment based on historical reliability
      const varianceMultiplier = 1 + (estimationData.varianceScore || 0.2);
      const adjustedSeconds = estimatedSeconds * varianceMultiplier;

      return new Date(Date.now() + adjustedSeconds * 1000);

    } catch (error) {
      console.error('Error estimating completion time:', error);
      // Return fallback estimate
      return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes fallback
    }
  }

  static async estimateWorkflowCompletion(workflowId: string): Promise<Date | null> {
    try {
      const workflow = await db.query`
        SELECT w.*, 
               COUNT(a.id) as total_agents,
               COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_agents,
               COUNT(CASE WHEN a.status = 'running' THEN 1 END) as running_agents
        FROM workflows w
        LEFT JOIN agents a ON w.id = a.workflow_id
        WHERE w.id = ${workflowId}
        GROUP BY w.id, w.project_id, w.status, w.progress, w.started_at, w.estimated_completion_time, w.completed_at, w.current_phase, w.created_at, w.updated_at
      `;

      if (!workflow.length) return null;

      const workflowData = workflow[0];
      
      // Get all agents with their estimated completion times
      const agents = await db.query`
        SELECT id, type, status, progress, estimated_completion_time
        FROM agents
        WHERE workflow_id = ${workflowId}
        ORDER BY created_at
      `;

      let latestEstimate: Date | null = null;

      for (const agent of agents) {
        if (agent.status === 'completed') continue;

        let agentEstimate: Date;
        
        if (agent.estimated_completion_time) {
          agentEstimate = agent.estimated_completion_time;
        } else {
          const estimate = await this.estimateAgentCompletion(
            agent.id,
            agent.type,
            agent.progress
          );
          if (!estimate) continue;
          agentEstimate = estimate;
        }

        if (!latestEstimate || agentEstimate > latestEstimate) {
          latestEstimate = agentEstimate;
        }
      }

      // Add buffer time for workflow coordination overhead
      if (latestEstimate) {
        const bufferMinutes = Math.max(5, Math.floor(workflowData.total_agents * 0.5));
        latestEstimate = new Date(latestEstimate.getTime() + bufferMinutes * 60 * 1000);
      }

      return latestEstimate;

    } catch (error) {
      console.error('Error estimating workflow completion:', error);
      return null;
    }
  }

  private static async getEstimationData(agentType: string): Promise<EstimationData> {
    const now = Date.now();
    
    // Check cache first
    if (
      this.estimationCache.has(agentType) && 
      now - this.lastCacheUpdate < this.CACHE_DURATION
    ) {
      return this.estimationCache.get(agentType)!;
    }

    try {
      const result = await db.query`
        SELECT 
          type,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration,
          COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as completion_rate,
          STDDEV(EXTRACT(EPOCH FROM (completed_at - started_at))) / NULLIF(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) as variance_score
        FROM agents
        WHERE type = ${agentType}
          AND started_at IS NOT NULL
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY type
      `;

      const estimationData: EstimationData = {
        agentType,
        avgDuration: result[0]?.avg_duration || 600,
        completionRate: result[0]?.completion_rate || 85,
        varianceScore: Math.min(result[0]?.variance_score || 0.2, 1.0)
      };

      this.estimationCache.set(agentType, estimationData);
      this.lastCacheUpdate = now;

      return estimationData;

    } catch (error) {
      console.error('Error getting estimation data:', error);
      return {
        agentType,
        avgDuration: 600, // 10 minutes default
        completionRate: 85,
        varianceScore: 0.2
      };
    }
  }

  private static async getAgentProgressHistory(
    agentId: string, 
    limit: number = 10
  ): Promise<ProgressPoint[]> {
    try {
      const result = await db.query`
        SELECT progress, created_at as timestamp
        FROM agent_progress_updates
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      return result.map(row => ({
        progress: row.progress,
        timestamp: row.timestamp
      })).reverse(); // Oldest first for velocity calculation

    } catch (error) {
      console.error('Error getting progress history:', error);
      return [];
    }
  }

  private static calculateVelocity(progressHistory: ProgressPoint[]): number {
    if (progressHistory.length < 2) return 0;

    // Calculate progress per second based on recent history
    let totalVelocity = 0;
    let validPairs = 0;

    for (let i = 1; i < progressHistory.length; i++) {
      const prev = progressHistory[i - 1];
      const curr = progressHistory[i];
      
      const progressDiff = curr.progress - prev.progress;
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000; // seconds
      
      if (timeDiff > 0 && progressDiff >= 0) {
        totalVelocity += progressDiff / timeDiff;
        validPairs++;
      }
    }

    return validPairs > 0 ? totalVelocity / validPairs : 0;
  }

  static async updateEstimations(workflowId: string): Promise<void> {
    try {
      // Update all agent estimations
      const agents = await db.query`
        SELECT id, type, progress, status
        FROM agents
        WHERE workflow_id = ${workflowId}
          AND status IN ('pending', 'running')
      `;

      for (const agent of agents) {
        const estimate = await this.estimateAgentCompletion(
          agent.id,
          agent.type,
          agent.progress
        );

        if (estimate) {
          await db.exec`
            UPDATE agents 
            SET estimated_completion_time = ${estimate}
            WHERE id = ${agent.id}
          `;
        }
      }

      // Update workflow estimation
      const workflowEstimate = await this.estimateWorkflowCompletion(workflowId);
      if (workflowEstimate) {
        await db.exec`
          UPDATE workflows 
          SET estimated_completion_time = ${workflowEstimate}
          WHERE id = ${workflowId}
        `;
      }

    } catch (error) {
      console.error('Error updating estimations:', error);
    }
  }
}