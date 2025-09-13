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
  // This would integrate with the Python agent system
  // For now, simulate the orchestration phases
  
  setTimeout(async () => {
    // Phase 1: Planning
    await updateOrchestrationStatus(orchestrationId, 'planning', 'Analyzing requirements and creating execution plan');
    
    setTimeout(async () => {
      // Phase 2: Architecture
      await updateOrchestrationStatus(orchestrationId, 'architecture', 'Designing system architecture and components');
      
      setTimeout(async () => {
        // Phase 3: Development
        await updateOrchestrationStatus(orchestrationId, 'development', 'Generating code and implementing features');
        
        setTimeout(async () => {
          // Phase 4: Integration
          await updateOrchestrationStatus(orchestrationId, 'integration', 'Integrating components and running tests');
          
          setTimeout(async () => {
            // Phase 5: Deployment
            await updateOrchestrationStatus(orchestrationId, 'deployment', 'Setting up deployment configuration');
            
            setTimeout(async () => {
              // Phase 6: Verification
              await updateOrchestrationStatus(orchestrationId, 'verification', 'Verifying implementation completeness');
              
              setTimeout(async () => {
                // Complete
                await updateOrchestrationStatus(orchestrationId, 'completed', 'Project generation completed successfully');
                
                // Update project status
                await projectsDB.exec`
                  UPDATE projects 
                  SET status = 'ready', updated_at = NOW()
                  WHERE id = ${req.projectId}
                `;
              }, 10000);
            }, 15000);
          }, 20000);
        }, 25000);
      }, 20000);
    }, 15000);
  }, 5000);
}

async function updateOrchestrationStatus(orchestrationId: string, status: AgentTaskStatus, message: string) {
  await agentsDB.exec`
    UPDATE orchestrations 
    SET status = ${status}, status_message = ${message}, updated_at = NOW()
    WHERE id = ${orchestrationId}
  `;
}