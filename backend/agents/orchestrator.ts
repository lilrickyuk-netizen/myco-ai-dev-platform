import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { AgentType, Agent, OrchestrationRequest, OrchestrationResponse } from "./types";
import { agentsDB } from "./db";
import { projects } from "~encore/clients";

// Orchestrates multi-agent tasks for project development.
export const orchestrate = api<OrchestrationRequest, OrchestrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/agents/orchestrate" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    // Determine required agents based on task and requirements
    const requiredAgents = determineRequiredAgents(req.task, req.requirements, req.agents);
    
    // Create workflow record
    const workflowId = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO agent_workflows (project_id, task_description, requirements)
      VALUES (${req.projectId}, ${req.task}, ${JSON.stringify(req.requirements)})
      RETURNING id
    `;

    if (!workflowId) {
      throw APIError.internal("failed to create workflow");
    }

    // Create agent tasks
    const agents: Agent[] = [];
    for (const agentType of requiredAgents) {
      const agent = getAgentDefinition(agentType);
      agents.push(agent);
      
      await agentsDB.exec`
        INSERT INTO agent_tasks (type, project_id, input, agent_id)
        VALUES (${agentType}, ${req.projectId}, ${JSON.stringify({
          task: req.task,
          requirements: req.requirements,
          workflowId: workflowId.id,
        })}, ${agent.id})
      `;
    }

    // Estimate duration based on complexity and agents
    const estimatedDuration = estimateTaskDuration(req.task, req.requirements, agents.length);

    return {
      taskId: workflowId.id,
      agents,
      estimatedDuration,
    };
  }
);

function determineRequiredAgents(
  task: string, 
  requirements: string[], 
  requestedAgents?: AgentType[]
): AgentType[] {
  if (requestedAgents && requestedAgents.length > 0) {
    return requestedAgents;
  }

  const agents: Set<AgentType> = new Set();
  
  // Always include architecture agent for planning
  agents.add('architecture');
  
  // Analyze task description
  const taskLower = task.toLowerCase();
  const reqText = requirements.join(' ').toLowerCase();
  
  if (taskLower.includes('frontend') || taskLower.includes('ui') || taskLower.includes('component')) {
    agents.add('frontend');
  }
  
  if (taskLower.includes('backend') || taskLower.includes('api') || taskLower.includes('server')) {
    agents.add('backend');
  }
  
  if (taskLower.includes('deploy') || taskLower.includes('infrastructure') || taskLower.includes('cloud')) {
    agents.add('infrastructure');
    agents.add('deployment');
  }
  
  if (taskLower.includes('security') || taskLower.includes('auth') || taskLower.includes('secure')) {
    agents.add('security');
  }
  
  if (taskLower.includes('test') || taskLower.includes('verify') || taskLower.includes('validation')) {
    agents.add('verification');
  }
  
  // Analyze requirements
  if (reqText.includes('react') || reqText.includes('vue') || reqText.includes('angular')) {
    agents.add('frontend');
  }
  
  if (reqText.includes('express') || reqText.includes('fastapi') || reqText.includes('spring')) {
    agents.add('backend');
  }
  
  // Default to full stack if not specific
  if (agents.size === 1) { // Only architecture
    agents.add('backend');
    agents.add('frontend');
    agents.add('verification');
  }
  
  return Array.from(agents);
}

function getAgentDefinition(type: AgentType): Agent {
  const definitions: Record<AgentType, Agent> = {
    architecture: {
      id: 'arch-001',
      type: 'architecture',
      name: 'Architecture Agent',
      description: 'Designs system architecture and technical specifications',
      capabilities: [
        'System design',
        'Technology selection',
        'Architecture patterns',
        'Component modeling',
      ],
      status: 'idle',
    },
    backend: {
      id: 'be-001',
      type: 'backend',
      name: 'Backend Agent',
      description: 'Develops server-side code and APIs',
      capabilities: [
        'API development',
        'Database design',
        'Server logic',
        'Performance optimization',
      ],
      status: 'idle',
    },
    frontend: {
      id: 'fe-001',
      type: 'frontend',
      name: 'Frontend Agent',
      description: 'Creates user interfaces and client-side functionality',
      capabilities: [
        'UI components',
        'State management',
        'Responsive design',
        'User experience',
      ],
      status: 'idle',
    },
    infrastructure: {
      id: 'infra-001',
      type: 'infrastructure',
      name: 'Infrastructure Agent',
      description: 'Manages cloud resources and DevOps',
      capabilities: [
        'Cloud configuration',
        'Container orchestration',
        'CI/CD pipelines',
        'Resource scaling',
      ],
      status: 'idle',
    },
    security: {
      id: 'sec-001',
      type: 'security',
      name: 'Security Agent',
      description: 'Implements security measures and audits',
      capabilities: [
        'Security scanning',
        'Authentication',
        'Data encryption',
        'Vulnerability assessment',
      ],
      status: 'idle',
    },
    verification: {
      id: 'verify-001',
      type: 'verification',
      name: 'Verification Agent',
      description: 'Ensures code quality and testing',
      capabilities: [
        'Unit testing',
        'Integration testing',
        'Code review',
        'Quality assurance',
      ],
      status: 'idle',
    },
    deployment: {
      id: 'deploy-001',
      type: 'deployment',
      name: 'Deployment Agent',
      description: 'Handles application deployment and monitoring',
      capabilities: [
        'Multi-cloud deployment',
        'Monitoring setup',
        'Health checks',
        'Rollback management',
      ],
      status: 'idle',
    },
  };
  
  return definitions[type];
}

function estimateTaskDuration(task: string, requirements: string[], agentCount: number): number {
  // Base duration in minutes
  let duration = 30;
  
  // Adjust for complexity
  const complexity = requirements.length;
  duration += complexity * 5;
  
  // Adjust for task type
  const taskLower = task.toLowerCase();
  if (taskLower.includes('complete') || taskLower.includes('full')) {
    duration *= 2;
  }
  
  if (taskLower.includes('simple') || taskLower.includes('basic')) {
    duration *= 0.5;
  }
  
  // More agents can work in parallel but with coordination overhead
  duration = duration * (1 + (agentCount - 1) * 0.3);
  
  return Math.ceil(duration);
}
