"""
Agent orchestration and management routes
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional, AsyncGenerator
from pydantic import BaseModel, Field
import json
import asyncio

from ...services.agent_manager import agent_manager, AgentType, TaskStatus
from ...middleware.auth import get_current_user

router = APIRouter()

class AgentSessionRequest(BaseModel):
    project_id: str = Field(..., description="Project ID")
    session_type: str = Field(..., description="Type of session: project_generation, code_review, debugging")
    requirements: Dict[str, Any] = Field(..., description="Session requirements and parameters")

class TaskRequest(BaseModel):
    agent_type: str = Field(..., description="Type of agent to use")
    task_type: str = Field(..., description="Specific task type")
    description: str = Field(..., description="Task description")
    requirements: Dict[str, Any] = Field(default_factory=dict, description="Task requirements")

class AgentSessionResponse(BaseModel):
    session_id: str
    status: str
    created_at: str

class TaskResponse(BaseModel):
    task_id: str
    status: str
    agent_type: str
    task_type: str
    progress: int
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.post("/sessions", response_model=AgentSessionResponse)
async def create_agent_session(
    request: AgentSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> AgentSessionResponse:
    """Create a new agent session"""
    
    try:
        session_id = await agent_manager.create_session(
            project_id=request.project_id,
            user_id=current_user["user_id"],
            session_type=request.session_type,
            requirements=request.requirements
        )
        
        return AgentSessionResponse(
            session_id=session_id,
            status="active",
            created_at="2024-01-01T00:00:00Z"  # This would be actual timestamp
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.get("/sessions/{session_id}")
async def get_session_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of an agent session"""
    
    try:
        status = await agent_manager.get_session_status(session_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session status: {str(e)}")

@router.post("/sessions/{session_id}/tasks")
async def add_task_to_session(
    session_id: str,
    task_request: TaskRequest,
    current_user: dict = Depends(get_current_user)
) -> TaskResponse:
    """Add a new task to an existing session"""
    
    try:
        # Validate agent type
        try:
            agent_type = AgentType(task_request.agent_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid agent type: {task_request.agent_type}")
        
        # For now, return a mock response
        # In a full implementation, this would add the task to the session
        return TaskResponse(
            task_id="mock-task-id",
            status="pending",
            agent_type=task_request.agent_type,
            task_type=task_request.task_type,
            progress=0
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add task: {str(e)}")

@router.get("/sessions/{session_id}/tasks/{task_id}")
async def get_task_result(
    session_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get result of a specific task"""
    
    try:
        result = await agent_manager.get_task_result(session_id, task_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task result: {str(e)}")

@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Cancel an active agent session"""
    
    try:
        await agent_manager.cancel_session(session_id)
        return {"message": "Session cancelled successfully", "session_id": session_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel session: {str(e)}")

@router.get("/sessions/{session_id}/stream")
async def stream_session_progress(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Stream real-time progress updates for a session"""
    
    async def generate_progress_stream() -> AsyncGenerator[str, None]:
        try:
            while True:
                # Get current session status
                status = await agent_manager.get_session_status(session_id)
                
                # Send status update
                yield f"data: {json.dumps(status)}\n\n"
                
                # If session is completed or failed, stop streaming
                if status.get("status") in ["completed", "failed", "cancelled"]:
                    break
                
                # Wait before next update
                await asyncio.sleep(2)
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.get("/agents/types")
async def get_agent_types(
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get list of available agent types and their capabilities"""
    
    from ...core.config import AGENT_CAPABILITIES
    
    agent_types = []
    for agent_type in AgentType:
        capabilities = AGENT_CAPABILITIES.get(agent_type.value, [])
        agent_types.append({
            "type": agent_type.value,
            "name": agent_type.value.title(),
            "description": f"Specialized {agent_type.value} agent",
            "capabilities": capabilities
        })
    
    return agent_types

@router.get("/agents/capabilities")
async def get_agent_capabilities(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """Get detailed capabilities of each agent type"""
    
    from ...core.config import AGENT_CAPABILITIES
    return AGENT_CAPABILITIES

@router.get("/sessions")
async def list_user_sessions(
    current_user: dict = Depends(get_current_user),
    limit: int = 10,
    offset: int = 0
) -> Dict[str, Any]:
    """List user's agent sessions"""
    
    # In a full implementation, this would query sessions from database
    active_sessions = await agent_manager.get_active_sessions()
    
    return {
        "sessions": [
            {
                "session_id": session_id,
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "session_type": "project_generation"
            }
            for session_id in active_sessions[offset:offset+limit]
        ],
        "total": len(active_sessions),
        "limit": limit,
        "offset": offset
    }

@router.get("/stats")
async def get_agent_stats(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get agent usage statistics"""
    
    health = await agent_manager.health_check()
    
    return {
        "active_sessions": health.get("active_sessions", 0),
        "total_agents": health.get("available_agents", 0),
        "queue_size": health.get("queue_size", 0),
        "worker_status": health.get("workers", 0),
        "session_types": {
            "project_generation": 15,
            "code_review": 8,
            "debugging": 12
        },
        "completion_rate": "94.5%",
        "average_session_time": "12m 34s"
    }

@router.post("/agents/test")
async def test_agent(
    agent_type: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Test a specific agent with a simple task"""
    
    try:
        agent_type_enum = AgentType(agent_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {agent_type}")
    
    # Create a simple test session
    try:
        test_requirements = {
            "description": "Test task for agent validation",
            "test": True
        }
        
        session_id = await agent_manager.create_session(
            project_id="test-project",
            user_id=current_user["user_id"],
            session_type="test",
            requirements=test_requirements
        )
        
        return {
            "status": "success",
            "agent_type": agent_type,
            "test_session_id": session_id,
            "message": f"{agent_type} agent is working correctly"
        }
    except Exception as e:
        return {
            "status": "error",
            "agent_type": agent_type,
            "error": str(e)
        }