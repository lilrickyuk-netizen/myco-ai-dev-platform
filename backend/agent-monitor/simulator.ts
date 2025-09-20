import { api } from "encore.dev/api";
import db from "../db";
import { broadcastProgressUpdate } from "./monitor";
import { CompletionTimeEstimator } from "./estimator";
import { AgentProgressUpdate } from "./types";

interface SimulationRequest {
  projectId: string;
  speed?: number; // Simulation speed multiplier (1 = normal, 2 = 2x faster)
}

interface SimulationResponse {
  workflowId: string;
  message: string;
}

// Create and start a simulated multi-agent workflow
export const startSimulation = api<SimulationRequest, SimulationResponse>(
  { expose: true, method: "POST", path: "/agent-monitor/simulate", auth: true },
  async (req): Promise<SimulationResponse> => {
    const speed = req.speed || 1;
    
    // Create a sample workflow
    const workflow = await db.queryRow`
      INSERT INTO workflows (project_id, current_phase, status)
      VALUES (${req.projectId}, 'Planning', 'running')
      RETURNING id
    `;
    const workflowId = workflow?.id;

    // Create phases
    const phases = [
      { name: 'Planning', description: 'Architecture and planning phase', estimatedDuration: 300, order: 0 },
      { name: 'Implementation', description: 'Code generation phase', estimatedDuration: 600, order: 1 },
      { name: 'Validation', description: 'Testing and validation phase', estimatedDuration: 180, order: 2 },
      { name: 'Deployment', description: 'Deployment and finalization', estimatedDuration: 120, order: 3 }
    ];

    const phaseIds = new Map<string, string>();
    for (const phase of phases) {
      const result = await db.queryAll`
        INSERT INTO workflow_phases (
          workflow_id, name, description, estimated_duration, phase_order
        )
        VALUES (${workflowId}, ${phase.name}, ${phase.description}, ${phase.estimatedDuration}, ${phase.order})
        RETURNING id
      `;
      phaseIds.set(phase.name, result[0].id);
    }

    // Create agents with dependencies
    const agentConfigs = [
      // Planning Phase
      { name: 'Architecture Planner', type: 'architecture', phase: 'Planning', dependencies: [] },
      { name: 'Requirements Analyzer', type: 'planner', phase: 'Planning', dependencies: [] },
      
      // Implementation Phase
      { name: 'Backend Generator', type: 'backend', phase: 'Implementation', dependencies: ['Architecture Planner'] },
      { name: 'Frontend Generator', type: 'frontend', phase: 'Implementation', dependencies: ['Architecture Planner'] },
      { name: 'Database Designer', type: 'backend', phase: 'Implementation', dependencies: ['Requirements Analyzer'] },
      
      // Validation Phase
      { name: 'Code Validator', type: 'validation', phase: 'Validation', dependencies: ['Backend Generator', 'Frontend Generator'] },
      { name: 'Integration Tester', type: 'validation', phase: 'Validation', dependencies: ['Database Designer'] },
      
      // Deployment Phase
      { name: 'Deployment Orchestrator', type: 'orchestrator', phase: 'Deployment', dependencies: ['Code Validator', 'Integration Tester'] }
    ];

    const agentIds = new Map<string, string>();
    
    // Create agents
    for (const config of agentConfigs) {
      const phaseId = phaseIds.get(config.phase);
      const result = await db.queryAll`
        INSERT INTO agents (workflow_id, phase_id, name, type)
        VALUES (${workflowId}, ${phaseId}, ${config.name}, ${config.type})
        RETURNING id
      `;
      agentIds.set(config.name, result[0].id);
    }

    // Create dependencies
    for (const config of agentConfigs) {
      const agentId = agentIds.get(config.name);
      for (const depName of config.dependencies) {
        const depAgentId = agentIds.get(depName);
        if (depAgentId) {
          await db.exec`
            INSERT INTO agent_dependencies (agent_id, depends_on_agent_id)
            VALUES (${agentId}, ${depAgentId})
          `;
        }
      }
    }

    // Start simulation
    simulateWorkflowExecution(workflowId, agentConfigs, agentIds, speed);

    return {
      workflowId,
      message: `Simulation started for workflow ${workflowId} at ${speed}x speed`
    };
  }
);

async function simulateWorkflowExecution(
  workflowId: string,
  agentConfigs: any[],
  agentIds: Map<string, string>,
  speed: number
) {
  const completedAgents = new Set<string>();
  const runningAgents = new Set<string>();

  // Start agents that have no dependencies
  const readyAgents = agentConfigs.filter(config => config.dependencies.length === 0);
  
  for (const agent of readyAgents) {
    const agentId = agentIds.get(agent.name)!;
    runningAgents.add(agentId);
    
    // Mark agent as running
    await db.exec`
      UPDATE agents 
      SET status = 'running', started_at = NOW()
      WHERE id = ${agentId}
    `;

    // Start agent simulation
    simulateAgentProgress(workflowId, agentId, agent, speed, completedAgents, runningAgents, agentConfigs, agentIds);
  }
}

async function simulateAgentProgress(
  workflowId: string,
  agentId: string,
  agentConfig: any,
  speed: number,
  completedAgents: Set<string>,
  runningAgents: Set<string>,
  allAgentConfigs: any[],
  agentIds: Map<string, string>
) {
  const updateInterval = Math.max(1000 / speed, 100); // Minimum 100ms between updates
  const totalSteps = 20; // 20 updates to reach 100%
  const stepProgress = 100 / totalSteps;
  
  // Simulate variable progress with some randomness
  const progressVariation = () => Math.random() * 0.3 + 0.7; // 0.7-1.0 multiplier
  
  for (let step = 0; step <= totalSteps; step++) {
    const baseProgress = step * stepProgress;
    const actualProgress = Math.min(100, baseProgress * progressVariation());
    
    // Estimate completion time
    const estimatedCompletion = await CompletionTimeEstimator.estimateAgentCompletion(
      agentId,
      agentConfig.type,
      actualProgress
    );
    
    // Ensure estimatedCompletion is a Date or null for the update
    const estimationTime: Date | undefined = estimatedCompletion || undefined;

    // Create progress update
    const update: AgentProgressUpdate = {
      workflowId,
      agentId,
      progress: Math.round(actualProgress),
      status: actualProgress >= 100 ? 'completed' : 'running',
      message: generateProgressMessage(agentConfig.name, actualProgress),
      estimatedCompletionTime: estimationTime,
      outputs: generateOutputs(agentConfig.type, actualProgress)
    };

    // Simulate occasional issues
    if (Math.random() < 0.05 && actualProgress < 100) { // 5% chance of temporary issue
      update.status = 'paused';
      update.message = `${agentConfig.name} encountered a temporary issue, retrying...`;
      update.error = 'Temporary processing delay';
    }

    // Broadcast update
    await broadcastProgressUpdate(update);

    if (actualProgress >= 100) {
      completedAgents.add(agentId);
      runningAgents.delete(agentId);
      
      // Check if any dependent agents can now start
      await startDependentAgents(workflowId, agentConfig.name, completedAgents, runningAgents, allAgentConfigs, agentIds, speed);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, updateInterval));
  }
}

function generateProgressMessage(agentName: string, progress: number): string {
  const messages = [
    `${agentName} initializing...`,
    `${agentName} analyzing requirements...`,
    `${agentName} processing data...`,
    `${agentName} generating code...`,
    `${agentName} optimizing output...`,
    `${agentName} running validation...`,
    `${agentName} finalizing results...`,
    `${agentName} completed successfully!`
  ];

  const messageIndex = Math.min(Math.floor(progress / 12.5), messages.length - 1);
  return messages[messageIndex];
}

function generateOutputs(agentType: string, progress: number): Record<string, any> {
  const outputs: Record<string, any> = {};

  if (progress > 25) {
    outputs.analysis = `${agentType} analysis phase completed`;
  }
  
  if (progress > 50) {
    outputs.artifacts = [`${agentType}_artifact_1.json`, `${agentType}_artifact_2.json`];
  }
  
  if (progress > 75) {
    outputs.metrics = {
      linesOfCode: Math.floor(Math.random() * 1000) + 100,
      complexity: Math.floor(Math.random() * 10) + 1,
      testCoverage: Math.floor(Math.random() * 30) + 70
    };
  }

  if (progress >= 100) {
    outputs.status = 'completed';
    outputs.finalArtifacts = [`${agentType}_final.zip`];
  }

  return outputs;
}

async function startDependentAgents(
  workflowId: string,
  completedAgentName: string,
  completedAgents: Set<string>,
  runningAgents: Set<string>,
  allAgentConfigs: any[],
  agentIds: Map<string, string>,
  speed: number
) {
  // Find agents that depend on the completed agent
  const dependentAgents = allAgentConfigs.filter(config => 
    config.dependencies.includes(completedAgentName)
  );

  for (const dependent of dependentAgents) {
    const dependentId = agentIds.get(dependent.name)!;
    
    // Check if this agent is already running or completed
    if (runningAgents.has(dependentId) || completedAgents.has(dependentId)) {
      continue;
    }

    // Check if all dependencies are completed
    const allDependenciesCompleted = dependent.dependencies.every((depName: string) => {
      const depId = agentIds.get(depName);
      return depId && completedAgents.has(depId);
    });

    if (allDependenciesCompleted) {
      runningAgents.add(dependentId);
      
      // Mark agent as running
      await db.exec`
        UPDATE agents 
        SET status = 'running', started_at = NOW()
        WHERE id = ${dependentId}
      `;

      // Start agent simulation
      simulateAgentProgress(workflowId, dependentId, dependent, speed, completedAgents, runningAgents, allAgentConfigs, agentIds);
    }
  }

  // Update workflow progress
  const totalAgents = allAgentConfigs.length;
  const workflowProgress = Math.round((completedAgents.size / totalAgents) * 100);
  
  await db.exec`
    UPDATE workflows 
    SET progress = ${workflowProgress}
    WHERE id = ${workflowId}
  `;

  // Check if workflow is complete
  if (completedAgents.size === totalAgents) {
    await db.exec`
      UPDATE workflows 
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${workflowId}
    `;
  }
}