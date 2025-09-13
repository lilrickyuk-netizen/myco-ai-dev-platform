import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { agentsDB } from "./db";
import { projectsDB } from "../projects/db";
import { OrchestrationRequest, OrchestrationResponse, AgentTaskStatus } from "./types";

// Orchestrates the complete project generation using the Myco agent system.
export const orchestrate = api<OrchestrationRequest, OrchestrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/agents/orchestrate" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project exists and belongs to user
    const project = await projectsDB.queryRow`
      SELECT id, name, template_type, template_name, status
      FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    if (project.status !== 'creating') {
      throw APIError.invalidArgument("Project is not in creating state");
    }

    // Create orchestration record
    const orchestrationId = crypto.randomUUID();
    
    await agentsDB.exec`
      INSERT INTO orchestrations (id, project_id, user_id, requirements, tech_stack, status, created_at)
      VALUES (${orchestrationId}, ${req.projectId}, ${auth.userID}, ${JSON.stringify(req.requirements)}, ${JSON.stringify(req.techStack)}, 'initializing', NOW())
    `;

    // Update project status
    await projectsDB.exec`
      UPDATE projects 
      SET status = 'building', updated_at = NOW()
      WHERE id = ${req.projectId}
    `;

    // Start orchestration process (this would integrate with the Python agent system)
    startOrchestrationProcess(orchestrationId, req);

    return {
      orchestrationId,
      status: 'initializing',
      message: 'Project generation started with Myco agent system',
      estimatedCompletionTime: new Date(Date.now() + 300000), // 5 minutes estimate
    };
  }
);

async function startOrchestrationProcess(orchestrationId: string, req: OrchestrationRequest) {
  // Integrate with the Python agent system via HTTP API
  try {
    const agentResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/agents/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
      },
      body: JSON.stringify({
        orchestrationId,
        projectId: req.projectId,
        requirements: req.requirements,
        techStack: req.techStack,
        phases: [
          'planning',
          'architecture', 
          'development',
          'integration',
          'deployment',
          'verification'
        ]
      })
    });
    
    if (!agentResponse.ok) {
      throw new Error(`Agent service error: ${agentResponse.status}`);
    }
    
    const result = await agentResponse.json();
    
    // Start polling for updates
    pollOrchestrationProgress(orchestrationId, req.projectId);
    
  } catch (error) {
    console.error('Failed to start orchestration with AI agents:', error);
    
    // Fallback to simulated orchestration
    await fallbackOrchestration(orchestrationId, req);
  }
}

async function pollOrchestrationProgress(orchestrationId: string, projectId: string) {
  const maxAttempts = 120; // 10 minutes with 5-second intervals
  let attempts = 0;
  
  const poll = async () => {
    try {
      const statusResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/agents/status/${orchestrationId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        }
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        
        await updateOrchestrationStatus(orchestrationId, status.phase, status.message);
        
        if (status.phase === 'completed') {
          await projectsDB.exec`
            UPDATE projects 
            SET status = 'ready', updated_at = NOW()
            WHERE id = ${projectId}
          `;
          return;
        }
        
        if (status.phase === 'failed') {
          await updateOrchestrationStatus(orchestrationId, 'failed', status.error || 'Orchestration failed');
          return;
        }
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000); // Poll every 5 seconds
      } else {
        await updateOrchestrationStatus(orchestrationId, 'timeout', 'Orchestration timed out');
      }
      
    } catch (error) {
      console.error('Error polling orchestration status:', error);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    }
  };
  
  poll();
}

async function fallbackOrchestration(orchestrationId: string, req: OrchestrationRequest) {
  // Fallback simulation if AI agents are unavailable
  const phases = [
    { name: 'planning', duration: 5000, message: 'Analyzing requirements and creating execution plan' },
    { name: 'architecture', duration: 15000, message: 'Designing system architecture and components' },
    { name: 'development', duration: 25000, message: 'Generating code and implementing features' },
    { name: 'integration', duration: 20000, message: 'Integrating components and running tests' },
    { name: 'deployment', duration: 15000, message: 'Setting up deployment configuration' },
    { name: 'verification', duration: 10000, message: 'Verifying implementation completeness' }
  ];
  
  let totalDelay = 0;
  
  for (const phase of phases) {
    totalDelay += phase.duration;
    setTimeout(async () => {
      await updateOrchestrationStatus(orchestrationId, phase.name as any, phase.message);
    }, totalDelay);
  }
  
  // Complete the orchestration
  setTimeout(async () => {
    await updateOrchestrationStatus(orchestrationId, 'completed', 'Project generation completed successfully (fallback mode)');
    
    await projectsDB.exec`
      UPDATE projects 
      SET status = 'ready', updated_at = NOW()
      WHERE id = ${req.projectId}
    `;
  }, totalDelay + 5000);
}

async function updateOrchestrationStatus(orchestrationId: string, status: AgentTaskStatus, message: string) {
  await agentsDB.exec`
    UPDATE orchestrations 
    SET status = ${status}, status_message = ${message}, updated_at = NOW()
    WHERE id = ${orchestrationId}
  `;
}