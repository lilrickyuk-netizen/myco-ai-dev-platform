"""
Agent management and orchestration routes
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
import uuid

from ...services.agent_manager import agent_manager, AgentType, TaskStatus
from ...middleware.auth import get_current_user

router = APIRouter()

class CreateSessionRequest(BaseModel):
    project_id: str = Field(..., description="Project ID")
    session_type: str = Field(..., description="Type of session")
    requirements: Dict[str, Any] = Field(..., description="Session requirements")

class CreateTaskRequest(BaseModel):
    agent_type: str = Field(..., description="Type of agent")
    task_type: str = Field(..., description="Type of task")
    description: str = Field(..., description="Task description")
    requirements: Dict[str, Any] = Field(default_factory=dict, description="Task requirements")
    dependencies: List[str] = Field(default_factory=list, description="Task dependencies")

class SessionResponse(BaseModel):
    session_id: str
    status: str
    progress: float
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    tasks: List[Dict[str, Any]]
    updated_at: str

class TaskResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    completed_at: Optional[str]

@router.post("/sessions", response_model=Dict[str, str])
async def create_session(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Create a new agent session"""
    
    try:
        session_id = await agent_manager.create_session(
            project_id=request.project_id,
            user_id=current_user["user_id"],
            session_type=request.session_type,
            requirements=request.requirements
        )
        
        return {"session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.get("/sessions", response_model=List[str])
async def list_active_sessions(
    current_user: dict = Depends(get_current_user)
) -> List[str]:
    """List all active agent sessions"""
    
    try:
        return await agent_manager.get_active_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
) -> SessionResponse:
    """Get status of a specific session"""
    
    try:
        status = await agent_manager.get_session_status(session_id)
        return SessionResponse(**status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session status: {str(e)}")

@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Cancel an active session"""
    
    try:
        await agent_manager.cancel_session(session_id)
        return {"message": "Session cancelled successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel session: {str(e)}")

@router.get("/sessions/{session_id}/tasks/{task_id}", response_model=TaskResponse)
async def get_task_result(
    session_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user)
) -> TaskResponse:
    """Get result of a specific task"""
    
    try:
        result = await agent_manager.get_task_result(session_id, task_id)
        return TaskResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task result: {str(e)}")

@router.get("/types")
async def get_agent_types() -> Dict[str, List[str]]:
    """Get available agent types and their capabilities"""
    
    from ...core.config import AGENT_CAPABILITIES
    
    return {
        "agent_types": [agent_type.value for agent_type in AgentType],
        "capabilities": AGENT_CAPABILITIES
    }

@router.get("/status")
async def get_agent_manager_status(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get overall agent manager status"""
    
    try:
        return await agent_manager.health_check()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent status: {str(e)}")

# Project generation workflow endpoints
@router.post("/generate/project")
async def generate_project(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Start a project generation workflow"""
    
    # Set session type to project_generation
    request.session_type = "project_generation"
    
    try:
        session_id = await agent_manager.create_session(
            project_id=request.project_id,
            user_id=current_user["user_id"],
            session_type=request.session_type,
            requirements=request.requirements
        )
        
        return {"session_id": session_id, "message": "Project generation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start project generation: {str(e)}")

@router.post("/review/code")
async def review_code(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Start a code review workflow"""
    
    # Set session type to code_review
    request.session_type = "code_review"
    
    try:
        session_id = await agent_manager.create_session(
            project_id=request.project_id,
            user_id=current_user["user_id"],
            session_type=request.session_type,
            requirements=request.requirements
        )
        
        return {"session_id": session_id, "message": "Code review started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start code review: {str(e)}")

@router.post("/debug/assistance")
async def debug_assistance(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, str]:
    """Start a debugging assistance workflow"""
    
    # Set session type to debugging
    request.session_type = "debugging"
    
    try:
        session_id = await agent_manager.create_session(
            project_id=request.project_id,
            user_id=current_user["user_id"],
            session_type=request.session_type,
            requirements=request.requirements
        )
        
        return {"session_id": session_id, "message": "Debugging assistance started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start debugging assistance: {str(e)}")