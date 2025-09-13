"""
Agent Manager - Orchestrates AI agents for different development tasks
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

from .llm_manager import llm_manager, LLMProvider
from ..core.config import settings, AGENT_CAPABILITIES

logger = logging.getLogger(__name__)

class AgentType(Enum):
    PLANNER = "planner"
    ARCHITECT = "architect" 
    BACKEND = "backend"
    FRONTEND = "frontend"
    DEVOPS = "devops"
    TESTER = "tester"

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class AgentTask:
    id: str
    agent_type: AgentType
    task_type: str
    description: str
    requirements: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    dependencies: List[str] = None
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class AgentSession:
    id: str
    project_id: str
    user_id: str
    session_type: str
    status: str
    tasks: List[AgentTask]
    progress: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class Agent:
    """Base agent class"""
    
    def __init__(self, agent_type: AgentType):
        self.agent_type = agent_type
        self.capabilities = AGENT_CAPABILITIES.get(agent_type.value, [])
        self.llm_provider = LLMProvider.OPENAI  # Default provider
        
    async def execute_task(self, task: AgentTask) -> Dict[str, Any]:
        """Execute a task and return results"""
        logger.info(f"Agent {self.agent_type.value} executing task: {task.id}")
        
        try:
            task.status = TaskStatus.IN_PROGRESS
            task.started_at = datetime.utcnow()
            
            # Build context and prompt for the task
            context = self._build_task_context(task)
            prompt = self._build_task_prompt(task)
            
            # Generate response using LLM
            response = await llm_manager.generate(
                prompt=prompt,
                context=context,
                provider=self.llm_provider,
                temperature=0.3  # Lower temperature for more consistent outputs
            )
            
            # Process the response based on task type
            result = await self._process_response(task, response.content)
            
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            task.result = result
            task.progress = 100
            
            logger.info(f"Task {task.id} completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Task {task.id} failed: {str(e)}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()
            raise
    
    def _build_task_context(self, task: AgentTask) -> str:
        """Build context for the task"""
        context = f"""
Agent Type: {self.agent_type.value}
Task Type: {task.task_type}
Capabilities: {', '.join(self.capabilities)}
Requirements: {json.dumps(task.requirements, indent=2)}
"""
        return context
    
    def _build_task_prompt(self, task: AgentTask) -> str:
        """Build prompt for the task"""
        prompt = f"""
As a {self.agent_type.value} agent, please help with the following task:

Task: {task.description}

Please provide a detailed response that includes:
1. Analysis of the requirements
2. Step-by-step approach
3. Specific recommendations
4. Implementation details
5. Potential risks and mitigations

Respond in JSON format with the following structure:
{{
    "analysis": "Your analysis here",
    "approach": ["step1", "step2", "step3"],
    "recommendations": ["rec1", "rec2", "rec3"],
    "implementation": "Detailed implementation details",
    "risks": ["risk1", "risk2"],
    "mitigations": ["mitigation1", "mitigation2"],
    "deliverables": ["deliverable1", "deliverable2"]
}}
"""
        return prompt
    
    async def _process_response(self, task: AgentTask, response: str) -> Dict[str, Any]:
        """Process LLM response and extract structured data"""
        try:
            # Try to parse as JSON first
            if response.strip().startswith('{'):
                return json.loads(response)
            
            # If not JSON, structure the response
            return {
                "response": response,
                "task_type": task.task_type,
                "agent_type": self.agent_type.value,
                "processed_at": datetime.utcnow().isoformat()
            }
        except json.JSONDecodeError:
            # Fallback to structured text response
            return {
                "response": response,
                "task_type": task.task_type,
                "agent_type": self.agent_type.value,
                "processed_at": datetime.utcnow().isoformat()
            }

class PlannerAgent(Agent):
    """Agent for project planning and requirements analysis"""
    
    def __init__(self):
        super().__init__(AgentType.PLANNER)
    
    def _build_task_prompt(self, task: AgentTask) -> str:
        if task.task_type == "project_planning":
            return f"""
As a senior project planner, analyze the following project requirements and create a comprehensive project plan:

Project Description: {task.description}
Requirements: {json.dumps(task.requirements, indent=2)}

Please provide a detailed project plan in JSON format:
{{
    "project_overview": "Brief overview of the project",
    "phases": [
        {{
            "name": "Phase name",
            "description": "Phase description", 
            "duration": "estimated duration",
            "deliverables": ["deliverable1", "deliverable2"],
            "dependencies": ["dependency1", "dependency2"]
        }}
    ],
    "tech_stack": {{
        "frontend": ["technology1", "technology2"],
        "backend": ["technology1", "technology2"],
        "database": ["technology1"],
        "infrastructure": ["technology1", "technology2"]
    }},
    "team_requirements": {{
        "roles": ["role1", "role2"],
        "skills": ["skill1", "skill2"]
    }},
    "risks": [
        {{
            "risk": "Risk description",
            "impact": "high/medium/low",
            "probability": "high/medium/low", 
            "mitigation": "Mitigation strategy"
        }}
    ],
    "timeline": {{
        "total_duration": "X weeks/months",
        "milestones": ["milestone1", "milestone2"]
    }}
}}
"""
        return super()._build_task_prompt(task)

class ArchitectAgent(Agent):
    """Agent for system architecture and design"""
    
    def __init__(self):
        super().__init__(AgentType.ARCHITECT)
    
    def _build_task_prompt(self, task: AgentTask) -> str:
        if task.task_type == "system_design":
            return f"""
As a senior software architect, design the system architecture for the following project:

Project Description: {task.description}
Requirements: {json.dumps(task.requirements, indent=2)}

Please provide a comprehensive system design in JSON format:
{{
    "architecture_overview": "High-level architecture description",
    "components": [
        {{
            "name": "Component name",
            "type": "frontend/backend/database/service",
            "description": "Component description",
            "technologies": ["tech1", "tech2"],
            "interfaces": ["API endpoints", "data formats"]
        }}
    ],
    "data_model": {{
        "entities": [
            {{
                "name": "Entity name",
                "attributes": ["attr1", "attr2"],
                "relationships": ["rel1", "rel2"]
            }}
        ]
    }},
    "api_design": {{
        "endpoints": [
            {{
                "method": "GET/POST/PUT/DELETE",
                "path": "/api/endpoint",
                "description": "Endpoint description",
                "request": "Request format",
                "response": "Response format"
            }}
        ]
    }},
    "security_considerations": ["security1", "security2"],
    "scalability_strategy": "How the system will scale",
    "deployment_architecture": "Deployment strategy and infrastructure"
}}
"""
        return super()._build_task_prompt(task)

class AgentManager:
    """Manages AI agents and orchestrates development tasks"""
    
    def __init__(self):
        self.agents: Dict[AgentType, Agent] = {}
        self.active_sessions: Dict[str, AgentSession] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.workers: List[asyncio.Task] = []
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all agent types"""
        self.agents[AgentType.PLANNER] = PlannerAgent()
        self.agents[AgentType.ARCHITECT] = ArchitectAgent()
        self.agents[AgentType.BACKEND] = Agent(AgentType.BACKEND)
        self.agents[AgentType.FRONTEND] = Agent(AgentType.FRONTEND)
        self.agents[AgentType.DEVOPS] = Agent(AgentType.DEVOPS)
        self.agents[AgentType.TESTER] = Agent(AgentType.TESTER)
        
        logger.info(f"Initialized {len(self.agents)} agents")
    
    async def initialize(self):
        """Initialize the agent manager"""
        # Start worker tasks
        for i in range(settings.MAX_CONCURRENT_REQUESTS):
            worker = asyncio.create_task(self._worker())
            self.workers.append(worker)
        
        logger.info("Agent manager initialized")
    
    async def cleanup(self):
        """Cleanup resources"""
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to finish
        await asyncio.gather(*self.workers, return_exceptions=True)
        
        logger.info("Agent manager cleaned up")
    
    async def _worker(self):
        """Worker task to process agent tasks"""
        while True:
            try:
                task = await self.task_queue.get()
                agent = self.agents.get(task.agent_type)
                
                if agent:
                    await agent.execute_task(task)
                else:
                    task.status = TaskStatus.FAILED
                    task.error = f"No agent available for type: {task.agent_type}"
                
                self.task_queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker error: {str(e)}")
    
    async def create_session(
        self,
        project_id: str,
        user_id: str,
        session_type: str,
        requirements: Dict[str, Any]
    ) -> str:
        """Create a new agent session"""
        
        session_id = str(uuid.uuid4())
        session = AgentSession(
            id=session_id,
            project_id=project_id,
            user_id=user_id,
            session_type=session_type,
            status="initializing",
            tasks=[],
            progress={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.active_sessions[session_id] = session
        
        # Create initial tasks based on session type
        if session_type == "project_generation":
            await self._create_project_generation_tasks(session, requirements)
        elif session_type == "code_review":
            await self._create_code_review_tasks(session, requirements)
        elif session_type == "debugging":
            await self._create_debugging_tasks(session, requirements)
        
        session.status = "active"
        session.updated_at = datetime.utcnow()
        
        logger.info(f"Created agent session: {session_id}")
        return session_id
    
    async def _create_project_generation_tasks(
        self,
        session: AgentSession,
        requirements: Dict[str, Any]
    ):
        """Create tasks for project generation"""
        
        # Task 1: Project Planning
        planning_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.PLANNER,
            task_type="project_planning",
            description=f"Create project plan for: {requirements.get('description', '')}",
            requirements=requirements
        )
        session.tasks.append(planning_task)
        await self.task_queue.put(planning_task)
        
        # Task 2: System Architecture (depends on planning)
        architecture_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.ARCHITECT,
            task_type="system_design", 
            description="Design system architecture",
            requirements=requirements,
            dependencies=[planning_task.id]
        )
        session.tasks.append(architecture_task)
        
        # Task 3: Backend Implementation
        backend_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.BACKEND,
            task_type="api_development",
            description="Implement backend APIs",
            requirements=requirements,
            dependencies=[architecture_task.id]
        )
        session.tasks.append(backend_task)
        
        # Task 4: Frontend Implementation
        frontend_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.FRONTEND,
            task_type="ui_development",
            description="Implement frontend UI",
            requirements=requirements,
            dependencies=[architecture_task.id]
        )
        session.tasks.append(frontend_task)
        
        # Task 5: Testing
        testing_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.TESTER,
            task_type="test_implementation",
            description="Create comprehensive tests",
            requirements=requirements,
            dependencies=[backend_task.id, frontend_task.id]
        )
        session.tasks.append(testing_task)
    
    async def _create_code_review_tasks(
        self,
        session: AgentSession,
        requirements: Dict[str, Any]
    ):
        """Create tasks for code review"""
        
        review_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.ARCHITECT,
            task_type="code_review",
            description="Review code for quality and best practices",
            requirements=requirements
        )
        session.tasks.append(review_task)
        await self.task_queue.put(review_task)
    
    async def _create_debugging_tasks(
        self,
        session: AgentSession,
        requirements: Dict[str, Any]
    ):
        """Create tasks for debugging assistance"""
        
        debug_task = AgentTask(
            id=str(uuid.uuid4()),
            agent_type=AgentType.BACKEND,  # Or determine based on code type
            task_type="debugging",
            description="Debug and fix code issues",
            requirements=requirements
        )
        session.tasks.append(debug_task)
        await self.task_queue.put(debug_task)
    
    async def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get status of an agent session"""
        
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        total_tasks = len(session.tasks)
        completed_tasks = len([t for t in session.tasks if t.status == TaskStatus.COMPLETED])
        failed_tasks = len([t for t in session.tasks if t.status == TaskStatus.FAILED])
        
        progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        return {
            "session_id": session_id,
            "status": session.status,
            "progress": progress,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "tasks": [
                {
                    "id": task.id,
                    "agent_type": task.agent_type.value,
                    "task_type": task.task_type,
                    "status": task.status.value,
                    "progress": task.progress,
                    "error": task.error
                }
                for task in session.tasks
            ],
            "updated_at": session.updated_at.isoformat()
        }
    
    async def get_task_result(self, session_id: str, task_id: str) -> Dict[str, Any]:
        """Get result of a specific task"""
        
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        task = next((t for t in session.tasks if t.id == task_id), None)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        
        return {
            "task_id": task_id,
            "status": task.status.value,
            "result": task.result,
            "error": task.error,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
    
    async def cancel_session(self, session_id: str):
        """Cancel an active session"""
        
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Cancel pending tasks
        for task in session.tasks:
            if task.status == TaskStatus.PENDING or task.status == TaskStatus.IN_PROGRESS:
                task.status = TaskStatus.CANCELLED
        
        session.status = "cancelled"
        session.updated_at = datetime.utcnow()
        
        logger.info(f"Cancelled session: {session_id}")
    
    async def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return list(self.active_sessions.keys())
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of agent manager"""
        
        return {
            "status": "healthy",
            "active_sessions": len(self.active_sessions),
            "available_agents": len(self.agents),
            "queue_size": self.task_queue.qsize(),
            "workers": len(self.workers)
        }

# Global instance
agent_manager = AgentManager()