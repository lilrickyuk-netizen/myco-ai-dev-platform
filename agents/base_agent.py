import json
import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from enum import Enum
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

from .llm_adapter import LLMManager, LLMMessage, LLMResponse, llm_manager
from .config import config

class AgentStatus(Enum):
    IDLE = "idle"
    WORKING = "working"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"

class TaskPriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class AgentType(Enum):
    ORCHESTRATOR = "orchestrator"
    PLANNER = "planner"
    ARCHITECTURE = "architecture"
    BACKEND = "backend"
    FRONTEND = "frontend"
    INFRASTRUCTURE = "infrastructure"
    SECURITY = "security"
    VERIFIER = "verifier"
    DEPLOYER = "deployer"
    MONITOR = "monitor"
    INTEGRATOR = "integrator"
    DOCUMENTER = "documenter"
    OPTIMIZER = "optimizer"

@dataclass
class Task:
    id: str
    type: str
    description: str
    priority: TaskPriority
    status: str = "pending"
    assigned_agent: Optional[str] = None
    dependencies: List[str] = None
    inputs: Dict[str, Any] = None
    outputs: Dict[str, Any] = None
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.inputs is None:
            self.inputs = {}
        if self.outputs is None:
            self.outputs = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class AgentExecutionContext:
    project_id: str
    user_id: str
    requirements: Dict[str, Any]
    project_type: str
    tech_stack: List[str]
    configuration: Dict[str, Any]
    workspace_path: str
    
class BaseAgent(ABC):
    def __init__(self, agent_id: str, agent_type: AgentType):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.status = AgentStatus.IDLE
        self.current_task: Optional[Task] = None
        self.capabilities: List[str] = []
        self.performance_metrics = {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "average_execution_time": 0.0,
            "success_rate": 0.0
        }
        
    @abstractmethod
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute a specific task and return results"""
        pass
    
    @abstractmethod
    def can_handle_task(self, task: Task) -> bool:
        """Check if agent can handle the given task"""
        pass
    
    async def start_task(self, task: Task, context: AgentExecutionContext):
        """Start executing a task"""
        self.status = AgentStatus.WORKING
        self.current_task = task
        task.assigned_agent = self.agent_id
        task.status = "in_progress"
        task.started_at = datetime.utcnow()
        
        try:
            result = await self.execute_task(task, context)
            task.outputs = result
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            self.status = AgentStatus.COMPLETED
            self.performance_metrics["tasks_completed"] += 1
            return result
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
            task.completed_at = datetime.utcnow()
            self.status = AgentStatus.FAILED
            self.performance_metrics["tasks_failed"] += 1
            raise
        finally:
            self.current_task = None
            self._update_success_rate()
    
    def _update_success_rate(self):
        total_tasks = self.performance_metrics["tasks_completed"] + self.performance_metrics["tasks_failed"]
        if total_tasks > 0:
            self.performance_metrics["success_rate"] = self.performance_metrics["tasks_completed"] / total_tasks
    
    def get_status(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type.value,
            "status": self.status.value,
            "current_task": self.current_task.id if self.current_task else None,
            "capabilities": self.capabilities,
            "performance_metrics": self.performance_metrics
        }