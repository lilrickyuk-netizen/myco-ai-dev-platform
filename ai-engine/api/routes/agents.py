"""
Agent management and orchestration routes
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
import asyncio
import uuid
from datetime import datetime

from ...services.agent_manager import agent_manager
from ...middleware.auth import get_current_user

router = APIRouter()

class AgentTask(BaseModel):
    type: str = Field(..., description="Type of task to execute")
    inputs: Dict[str, Any] = Field(..., description="Task inputs")
    priority: Optional[str] = Field("normal", description="Task priority")
    timeout: Optional[int] = Field(300, description="Task timeout in seconds")

class ProjectGenerationRequest(BaseModel):
    name: str = Field(..., description="Project name")
    description: str = Field(..., description="Project description")
    requirements: Dict[str, Any] = Field(..., description="Project requirements")
    tech_stack: Dict[str, Any] = Field(..., description="Technology stack")
    architecture: Optional[Dict[str, Any]] = Field(None, description="Architecture preferences")

class AgentStatus(BaseModel):
    agent_id: str
    agent_type: str
    status: str
    current_task: Optional[str]
    last_activity: datetime
    capabilities: List[str]

class TaskResult(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

@router.get("/status")
async def get_agents_status(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of all agents"""
    
    try:
        status = await agent_manager.get_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent status: {str(e)}")

@router.get("/agents")
async def list_agents(
    current_user: dict = Depends(get_current_user)
) -> List[AgentStatus]:
    """List all available agents"""
    
    try:
        agents = await agent_manager.list_agents()
        return [
            AgentStatus(
                agent_id=agent["id"],
                agent_type=agent["type"],
                status=agent["status"],
                current_task=agent.get("current_task"),
                last_activity=agent["last_activity"],
                capabilities=agent["capabilities"]
            )
            for agent in agents
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list agents: {str(e)}")

@router.post("/task")
async def execute_task(
    task: AgentTask,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Execute a task using appropriate agent"""
    
    try:
        task_id = str(uuid.uuid4())
        
        # Start task execution in background
        background_tasks.add_task(
            _execute_agent_task,
            task_id,
            task.type,
            task.inputs,
            task.priority,
            task.timeout,
            current_user["id"]
        )
        
        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Task has been queued for execution"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue task: {str(e)}")

@router.get("/task/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(get_current_user)
) -> TaskResult:
    """Get status of a specific task"""
    
    try:
        task_info = await agent_manager.get_task_status(task_id)
        
        if not task_info:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return TaskResult(
            task_id=task_id,
            status=task_info["status"],
            result=task_info.get("result"),
            error=task_info.get("error"),
            created_at=task_info["created_at"],
            completed_at=task_info.get("completed_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")

@router.post("/generate-project")
async def generate_project(
    request: ProjectGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generate a complete project using the agent system"""
    
    try:
        task_id = str(uuid.uuid4())
        
        # Prepare project generation inputs
        inputs = {
            "name": request.name,
            "description": request.description,
            "requirements": request.requirements,
            "tech_stack": request.tech_stack,
            "architecture": request.architecture or {},
            "user_id": current_user["id"]
        }
        
        # Start project generation in background
        background_tasks.add_task(
            _generate_complete_project,
            task_id,
            inputs
        )
        
        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Project generation has been queued",
            "estimated_time": "5-10 minutes"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start project generation: {str(e)}")

@router.get("/capabilities")
async def get_agent_capabilities(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """Get capabilities of each agent type"""
    
    try:
        capabilities = await agent_manager.get_capabilities()
        return capabilities
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get capabilities: {str(e)}")

@router.post("/agents/{agent_id}/stop")
async def stop_agent(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Stop a running agent"""
    
    try:
        success = await agent_manager.stop_agent(agent_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found or already stopped")
        
        return {
            "status": "success",
            "message": f"Agent {agent_id} has been stopped"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop agent: {str(e)}")

async def _execute_agent_task(
    task_id: str,
    task_type: str,
    inputs: Dict[str, Any],
    priority: str,
    timeout: int,
    user_id: str
):
    """Background task to execute agent task"""
    try:
        result = await agent_manager.execute_task(
            task_type=task_type,
            inputs=inputs,
            priority=priority,
            timeout=timeout,
            user_id=user_id
        )
        
        await agent_manager.update_task_status(
            task_id,
            "completed",
            result=result
        )
    except Exception as e:
        await agent_manager.update_task_status(
            task_id,
            "failed",
            error=str(e)
        )

async def _generate_complete_project(
    task_id: str,
    inputs: Dict[str, Any]
):
    """Background task to generate complete project"""
    try:
        # This would orchestrate multiple agents to generate a complete project
        result = await agent_manager.orchestrate_project_generation(inputs)
        
        await agent_manager.update_task_status(
            task_id,
            "completed",
            result=result
        )
    except Exception as e:
        await agent_manager.update_task_status(
            task_id,
            "failed",
            error=str(e)
        )