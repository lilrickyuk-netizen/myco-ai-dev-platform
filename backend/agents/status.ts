import { api, StreamOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { projectsDB } from "../projects/db";
import { AgentLog } from "./types";

export interface StatusStreamParams {
  sessionId: string;
}

export interface StatusMessage {
  type: 'progress' | 'log' | 'task_update' | 'completion';
  data: any;
  timestamp: Date;
}

// Streams real-time status updates for an agent session.
export const statusStream = api.streamOut<StatusStreamParams, StatusMessage>(
  { auth: true, expose: true, path: "/agents/sessions/:sessionId/status" },
  async ({ sessionId }, stream) => {
    const auth = getAuthData()!;

    // Verify session exists and user has access
    const session = await agentsDB.queryRow`
      SELECT project_id FROM agent_sessions WHERE id = ${sessionId}
    `;

    if (!session) {
      await stream.send({
        type: 'log',
        data: { level: 'error', message: 'Session not found' },
        timestamp: new Date(),
      });
      return;
    }

    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${session.project_id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      await stream.send({
        type: 'log',
        data: { level: 'error', message: 'Project not found' },
        timestamp: new Date(),
      });
      return;
    }

    // Send initial status
    const currentSession = await agentsDB.queryRow`
      SELECT status, progress FROM agent_sessions WHERE id = ${sessionId}
    `;

    if (currentSession) {
      await stream.send({
        type: 'progress',
        data: {
          status: currentSession.status,
          progress: typeof currentSession.progress === 'string' 
            ? JSON.parse(currentSession.progress) 
            : currentSession.progress,
        },
        timestamp: new Date(),
      });
    }

    // Get recent logs
    const logs: AgentLog[] = [];
    for await (const row of agentsDB.query<AgentLog>`
      SELECT 
        id,
        session_id as "sessionId",
        task_id as "taskId",
        level,
        message,
        metadata,
        timestamp
      FROM agent_logs 
      WHERE session_id = ${sessionId}
      ORDER BY timestamp DESC
      LIMIT 10
    `) {
      logs.push({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      });
    }

    // Send recent logs
    for (const log of logs.reverse()) {
      await stream.send({
        type: 'log',
        data: log,
        timestamp: log.timestamp,
      });
    }

    // Simulate real-time updates (in a real implementation, this would listen to database changes or message queues)
    const interval = setInterval(async () => {
      try {
        // Check for session completion
        const sessionStatus = await agentsDB.queryRow`
          SELECT status, progress FROM agent_sessions WHERE id = ${sessionId}
        `;

        if (sessionStatus) {
          await stream.send({
            type: 'progress',
            data: {
              status: sessionStatus.status,
              progress: typeof sessionStatus.progress === 'string' 
                ? JSON.parse(sessionStatus.progress) 
                : sessionStatus.progress,
            },
            timestamp: new Date(),
          });

          if (sessionStatus.status === 'completed' || sessionStatus.status === 'failed') {
            await stream.send({
              type: 'completion',
              data: { status: sessionStatus.status },
              timestamp: new Date(),
            });
            clearInterval(interval);
            await stream.close();
          }
        }
      } catch (error) {
        console.error('Status stream error:', error);
        clearInterval(interval);
        await stream.close();
      }
    }, 2000); // Check every 2 seconds

    // Clean up on stream close
    stream.onClose(() => {
      clearInterval(interval);
    });
  }
);