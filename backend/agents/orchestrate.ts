import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { agentsDB } from "./db";
import { 
  OrchestrationRequest, 
  OrchestrationResponse, 
  ProjectGenerationRequest,
  AgentTaskStatus
} from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface StartOrchestrationRequest extends OrchestrationRequest {}

export interface CancelOrchestrationRequest {
  orchestrationId: string;
  reason?: string;
}

export interface UpdateOrchestrationProgressRequest {
  orchestrationId: string;
  status: AgentTaskStatus;
  progressPercentage?: number;
  currentPhase?: string;
  statusMessage?: string;
  estimatedCompletion?: Date;
}

export interface GenerateProjectRequest extends ProjectGenerationRequest {}

export const startOrchestration = api<StartOrchestrationRequest, OrchestrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/agents/orchestrate" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.requirements) {
      throw APIError.invalidArgument("Project ID and requirements are required");
    }

    // Verify project ownership
    const project = await projectsDB.queryRow`
      SELECT id, name FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;
    
    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    // Check for existing active orchestrations
    const existingOrchestration = await agentsDB.queryRow`
      SELECT id FROM orchestrations 
      WHERE project_id = ${req.projectId} 
      AND status IN ('initializing', 'planning', 'architecture', 'development', 'integration', 'testing', 'security', 'deployment', 'verification')
    `;

    if (existingOrchestration) {
      throw APIError.alreadyExists("An orchestration is already running for this project");
    }

    // Calculate estimated completion time (basic estimation)
    const estimatedDuration = calculateEstimatedDuration(req.requirements, req.techStack);
    const estimatedCompletion = new Date(Date.now() + estimatedDuration);

    // Create orchestration record
    const orchestration = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO orchestrations (
        project_id, 
        user_id, 
        requirements, 
        tech_stack, 
        status, 
        current_phase,
        estimated_completion
      )
      VALUES (
        ${req.projectId}, 
        ${auth.userID}, 
        ${JSON.stringify(req.requirements)},
        ${JSON.stringify(req.techStack)},
        'initializing',
        'Project Analysis',
        ${estimatedCompletion}
      )
      RETURNING id
    `;

    if (!orchestration) {
      throw APIError.internal("Failed to create orchestration");
    }

    // Create initial agent session
    const session = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO agent_sessions (project_id, user_id, type, status, request)
      VALUES (
        ${req.projectId}, 
        ${auth.userID}, 
        'orchestration', 
        'running', 
        ${JSON.stringify({
          orchestrationId: orchestration.id,
          requirements: req.requirements,
          techStack: req.techStack,
          configuration: req.configuration
        })}
      )
      RETURNING id
    `;

    if (!session) {
      throw APIError.internal("Failed to create agent session");
    }

    // Create initial planning task
    await agentsDB.exec`
      INSERT INTO agent_tasks (session_id, agent_name, task_type, status, input)
      VALUES (
        ${session.id}, 
        'orchestrator', 
        'project_analysis', 
        'pending',
        ${JSON.stringify({
          projectId: req.projectId,
          requirements: req.requirements,
          techStack: req.techStack
        })}
      )
    `;

    return {
      orchestrationId: orchestration.id,
      status: 'initializing',
      message: 'Orchestration started successfully. Analyzing project requirements...',
      estimatedCompletionTime: estimatedCompletion
    };
  }
);

export const cancelOrchestration = api<CancelOrchestrationRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/agents/orchestrate/:orchestrationId/cancel" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.orchestrationId) {
      throw APIError.invalidArgument("Orchestration ID is required");
    }

    // Verify orchestration ownership
    const orchestration = await agentsDB.queryRow`
      SELECT id, status FROM orchestrations 
      WHERE id = ${req.orchestrationId} AND user_id = ${auth.userID}
    `;
    
    if (!orchestration) {
      throw APIError.notFound("Orchestration not found or access denied");
    }

    if (orchestration.status === 'completed' || orchestration.status === 'failed' || orchestration.status === 'cancelled') {
      throw APIError.invalidArgument("Cannot cancel orchestration that is already completed, failed, or cancelled");
    }

    // Update orchestration status
    await agentsDB.exec`
      UPDATE orchestrations 
      SET 
        status = 'cancelled',
        status_message = ${req.reason || 'Cancelled by user'},
        updated_at = NOW()
      WHERE id = ${req.orchestrationId}
    `;

    // Cancel all running agent sessions for this orchestration
    await agentsDB.exec`
      UPDATE agent_sessions 
      SET 
        status = 'cancelled',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE project_id = (
        SELECT project_id FROM orchestrations WHERE id = ${req.orchestrationId}
      ) 
      AND status = 'running'
    `;

    // Cancel all pending/running tasks
    await agentsDB.exec`
      UPDATE agent_tasks 
      SET 
        status = 'cancelled',
        completed_at = NOW()
      WHERE session_id IN (
        SELECT s.id FROM agent_sessions s
        JOIN orchestrations o ON s.project_id = o.project_id
        WHERE o.id = ${req.orchestrationId}
      )
      AND status IN ('pending', 'running', 'in_progress')
    `;

    return { success: true };
  }
);

export const updateOrchestrationProgress = api<UpdateOrchestrationProgressRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/agents/orchestrate/:orchestrationId/progress" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.orchestrationId || !req.status) {
      throw APIError.invalidArgument("Orchestration ID and status are required");
    }

    // Verify orchestration ownership (relaxed for internal agent updates)
    const orchestration = await agentsDB.queryRow`
      SELECT id FROM orchestrations 
      WHERE id = ${req.orchestrationId}
    `;
    
    if (!orchestration) {
      throw APIError.notFound("Orchestration not found");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    updates.push(`status = $${paramIndex++}`);
    values.push(req.status);

    if (req.progressPercentage !== undefined) {
      updates.push(`progress_percentage = $${paramIndex++}`);
      values.push(req.progressPercentage);
    }

    if (req.currentPhase) {
      updates.push(`current_phase = $${paramIndex++}`);
      values.push(req.currentPhase);
    }

    if (req.statusMessage) {
      updates.push(`status_message = $${paramIndex++}`);
      values.push(req.statusMessage);
    }

    if (req.estimatedCompletion) {
      updates.push(`estimated_completion = $${paramIndex++}`);
      values.push(req.estimatedCompletion);
    }

    updates.push(`updated_at = NOW()`);

    values.push(req.orchestrationId);
    const query = `
      UPDATE orchestrations 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await agentsDB.exec(query, ...values);
    return { success: true };
  }
);

export const generateProject = api<GenerateProjectRequest, OrchestrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/agents/generate" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.name || !req.templateType || !req.templateName) {
      throw APIError.invalidArgument("Name, template type, and template name are required");
    }

    // Check if project name already exists
    const existingProject = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE user_id = ${auth.userID} AND name = ${req.name}
    `;
    
    if (existingProject) {
      throw APIError.alreadyExists("Project with this name already exists");
    }

    // Create the project first
    const project = await projectsDB.queryRow<{ id: string }>`
      INSERT INTO projects (
        name, 
        description, 
        template_type, 
        template_name, 
        user_id, 
        status
      )
      VALUES (
        ${req.name}, 
        ${req.description || null}, 
        ${req.templateType}, 
        ${req.templateName}, 
        ${auth.userID}, 
        'creating'
      )
      RETURNING id
    `;

    if (!project) {
      throw APIError.internal("Failed to create project");
    }

    // Start orchestration for the new project
    const orchestrationRequest: OrchestrationRequest = {
      projectId: project.id,
      requirements: req.requirements,
      techStack: req.techStack,
      configuration: {
        environment: 'development',
        template: {
          type: req.templateType,
          name: req.templateName
        }
      }
    };

    // Calculate estimated completion time
    const estimatedDuration = calculateEstimatedDuration(req.requirements, req.techStack);
    const estimatedCompletion = new Date(Date.now() + estimatedDuration);

    // Create orchestration record
    const orchestration = await agentsDB.queryRow<{ id: string }>`
      INSERT INTO orchestrations (
        project_id, 
        user_id, 
        requirements, 
        tech_stack, 
        status, 
        current_phase,
        estimated_completion
      )
      VALUES (
        ${project.id}, 
        ${auth.userID}, 
        ${JSON.stringify(req.requirements)},
        ${JSON.stringify(req.techStack)},
        'initializing',
        'Template Setup',
        ${estimatedCompletion}
      )
      RETURNING id
    `;

    if (!orchestration) {
      throw APIError.internal("Failed to create orchestration");
    }

    return {
      orchestrationId: orchestration.id,
      status: 'initializing',
      message: `Project "${req.name}" created successfully. Starting code generation...`,
      estimatedCompletionTime: estimatedCompletion
    };
  }
);

export const retryOrchestration = api<{ orchestrationId: string }, OrchestrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/agents/orchestrate/:orchestrationId/retry" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.orchestrationId) {
      throw APIError.invalidArgument("Orchestration ID is required");
    }

    // Verify orchestration ownership
    const orchestration = await agentsDB.queryRow<{
      id: string;
      project_id: string;
      status: AgentTaskStatus;
      requirements: string;
      tech_stack: string;
    }>`
      SELECT id, project_id, status, requirements, tech_stack
      FROM orchestrations 
      WHERE id = ${req.orchestrationId} AND user_id = ${auth.userID}
    `;
    
    if (!orchestration) {
      throw APIError.notFound("Orchestration not found or access denied");
    }

    if (orchestration.status !== 'failed' && orchestration.status !== 'cancelled') {
      throw APIError.invalidArgument("Can only retry failed or cancelled orchestrations");
    }

    // Reset orchestration to initializing state
    const estimatedDuration = calculateEstimatedDuration(
      JSON.parse(orchestration.requirements), 
      JSON.parse(orchestration.tech_stack)
    );
    const estimatedCompletion = new Date(Date.now() + estimatedDuration);

    await agentsDB.exec`
      UPDATE orchestrations 
      SET 
        status = 'initializing',
        progress_percentage = 0,
        current_phase = 'Retry Initialization',
        status_message = 'Retrying orchestration...',
        estimated_completion = ${estimatedCompletion},
        updated_at = NOW()
      WHERE id = ${req.orchestrationId}
    `;

    return {
      orchestrationId: orchestration.id,
      status: 'initializing',
      message: 'Orchestration retry started successfully',
      estimatedCompletionTime: estimatedCompletion
    };
  }
);

function calculateEstimatedDuration(
  requirements: { features: string[]; constraints?: string[]; performance?: string[]; security?: string[] },
  techStack: { frontend?: string; backend?: string; database?: string; deployment?: string; language?: string; framework?: string }
): number {
  // Base duration: 10 minutes
  let durationMs = 10 * 60 * 1000;

  // Add time based on number of features
  const featureCount = requirements.features.length;
  durationMs += featureCount * 2 * 60 * 1000; // 2 minutes per feature

  // Add time for constraints
  if (requirements.constraints && requirements.constraints.length > 0) {
    durationMs += requirements.constraints.length * 1 * 60 * 1000; // 1 minute per constraint
  }

  // Add time for performance requirements
  if (requirements.performance && requirements.performance.length > 0) {
    durationMs += requirements.performance.length * 1.5 * 60 * 1000; // 1.5 minutes per performance requirement
  }

  // Add time for security requirements
  if (requirements.security && requirements.security.length > 0) {
    durationMs += requirements.security.length * 2 * 60 * 1000; // 2 minutes per security requirement
  }

  // Add time based on tech stack complexity
  const stackComponents = Object.values(techStack).filter(Boolean).length;
  durationMs += stackComponents * 1 * 60 * 1000; // 1 minute per stack component

  // Cap at 2 hours maximum
  return Math.min(durationMs, 2 * 60 * 60 * 1000);
}