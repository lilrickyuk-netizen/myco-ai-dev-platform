"""
Agent Manager - Orchestrates AI agents for different development tasks
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum
from dataclasses import dataclass, asdict
import json

from .llm_manager import llm_manager
from .cache_manager import cache_manager

logger = logging.getLogger(__name__)

class AgentType(Enum):
    PLANNER = "planner"
    ARCHITECT = "architect"
    BACKEND = "backend"
    FRONTEND = "frontend"
    ORCHESTRATOR = "orchestrator"

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class AgentTask:
    task_id: str
    agent_type: AgentType
    task_type: str
    description: str
    requirements: Dict[str, Any]
    dependencies: List[str]
    status: TaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class AgentSession:
    session_id: str
    project_id: str
    user_id: str
    session_type: str
    requirements: Dict[str, Any]
    tasks: List[AgentTask]
    status: str
    progress: float = 0.0
    created_at: datetime = None
    updated_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = datetime.now()

class AgentManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.sessions: Dict[str, AgentSession] = {}
        self.active_tasks: Dict[str, AgentTask] = {}
        self.agent_prompts = self._load_agent_prompts()
    
    def _load_agent_prompts(self) -> Dict[AgentType, Dict[str, str]]:
        """Load prompts for different agent types and tasks"""
        return {
            AgentType.PLANNER: {
                "project_analysis": """You are a senior project planner. Analyze the following project requirements and create a comprehensive development plan:

Requirements: {requirements}

Provide:
1. Project scope and objectives
2. Technology stack recommendations
3. Development phases and milestones
4. Risk assessment and mitigation strategies
5. Resource allocation suggestions
6. Timeline estimates

Format your response as structured JSON with clear sections.""",
                
                "task_breakdown": """Break down the following development task into smaller, manageable subtasks:

Task: {task_description}
Context: {context}

Provide:
1. Detailed subtask list with priorities
2. Dependencies between tasks
3. Estimated effort for each subtask
4. Resource requirements
5. Acceptance criteria

Format as JSON with clear task structure."""
            },
            
            AgentType.ARCHITECT: {
                "system_design": """You are a senior software architect. Design the system architecture for:

Project: {project_description}
Requirements: {requirements}
Technology Stack: {tech_stack}

Provide:
1. High-level system architecture
2. Component design and interactions
3. Data flow diagrams
4. API design specifications
5. Database schema recommendations
6. Security considerations
7. Scalability and performance considerations

Format as detailed technical documentation.""",
                
                "code_review": """Review the following code architecture and provide recommendations:

Code: {code}
Context: {context}

Analyze:
1. Architectural patterns used
2. Code organization and structure
3. Design principles adherence
4. Potential improvements
5. Security considerations
6. Performance implications

Provide specific, actionable recommendations."""
            },
            
            AgentType.BACKEND: {
                "api_development": """You are a senior backend developer. Develop the following API:

Specification: {api_spec}
Requirements: {requirements}
Framework: {framework}

Provide:
1. Complete API implementation
2. Data models and schemas
3. Error handling
4. Input validation
5. Authentication/authorization
6. Documentation
7. Unit tests

Ensure production-ready code with best practices.""",
                
                "database_design": """Design and implement the database layer for:

Requirements: {requirements}
Data Model: {data_model}
Database Type: {db_type}

Provide:
1. Database schema design
2. Migration scripts
3. Query optimization
4. Indexing strategy
5. Data validation rules
6. Backup and recovery considerations"""
            },
            
            AgentType.FRONTEND: {
                "ui_development": """You are a senior frontend developer. Implement the following UI component:

Component Specification: {component_spec}
Framework: {framework}
Design System: {design_system}

Provide:
1. Complete component implementation
2. Responsive design
3. Accessibility compliance
4. Performance optimization
5. Type definitions
6. Unit tests
7. Storybook documentation

Ensure modern, maintainable code.""",
                
                "user_experience": """Analyze and improve the user experience for:

Current Implementation: {current_ui}
User Requirements: {user_requirements}
Target Audience: {target_audience}

Provide:
1. UX analysis and recommendations
2. Improved user flows
3. Interface optimizations
4. Accessibility improvements
5. Performance enhancements
6. Mobile responsiveness
7. Implementation guidelines"""
            },
            
            AgentType.ORCHESTRATOR: {
                "workflow_coordination": """Coordinate the following development workflow:

Tasks: {tasks}
Dependencies: {dependencies}
Resources: {resources}

Provide:
1. Optimal task execution order
2. Resource allocation strategy
3. Parallel execution opportunities
4. Risk mitigation plans
5. Progress tracking recommendations
6. Quality gates and checkpoints"""
            }
        }
    
    async def initialize(self):
        """Initialize the agent manager"""
        self.logger.info("Initializing Agent Manager...")
        # Load any persisted sessions from cache
        try:
            cached_sessions = await cache_manager.get("agent_sessions")
            if cached_sessions:
                self.sessions = {
                    session_id: AgentSession(**session_data)
                    for session_id, session_data in cached_sessions.items()
                }
                self.logger.info(f"Loaded {len(self.sessions)} cached sessions")
        except Exception as e:
            self.logger.warning(f"Could not load cached sessions: {e}")
        
        self.logger.info("Agent Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("Cleaning up Agent Manager...")
        # Save sessions to cache
        try:
            sessions_data = {
                session_id: asdict(session)
                for session_id, session in self.sessions.items()
            }
            await cache_manager.set("agent_sessions", sessions_data, ttl=86400)  # 24 hours
            self.logger.info("Sessions saved to cache")
        except Exception as e:
            self.logger.warning(f"Could not save sessions to cache: {e}")
        
        self.logger.info("Agent Manager cleanup complete")
    
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
            session_id=session_id,
            project_id=project_id,
            user_id=user_id,
            session_type=session_type,
            requirements=requirements,
            tasks=[],
            status="initializing"
        )
        
        self.sessions[session_id] = session
        
        # Generate initial tasks based on session type
        tasks = await self._generate_session_tasks(session)
        session.tasks = tasks
        session.status = "active"
        
        self.logger.info(f"Created session {session_id} with {len(tasks)} tasks")
        
        # Start executing tasks
        asyncio.create_task(self._execute_session_tasks(session_id))
        
        return session_id
    
    async def _generate_session_tasks(self, session: AgentSession) -> List[AgentTask]:
        """Generate tasks for a session based on its type"""
        tasks = []
        
        if session.session_type == "project_generation":
            # Project generation workflow
            tasks.extend([
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.PLANNER,
                    task_type="project_analysis",
                    description="Analyze project requirements and create development plan",
                    requirements=session.requirements,
                    dependencies=[],
                    status=TaskStatus.PENDING
                ),
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.ARCHITECT,
                    task_type="system_design",
                    description="Design system architecture",
                    requirements=session.requirements,
                    dependencies=[],  # Will be updated with planner task ID
                    status=TaskStatus.PENDING
                ),
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.BACKEND,
                    task_type="api_development",
                    description="Implement backend APIs",
                    requirements=session.requirements,
                    dependencies=[],  # Will be updated with architect task ID
                    status=TaskStatus.PENDING
                ),
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.FRONTEND,
                    task_type="ui_development",
                    description="Implement frontend components",
                    requirements=session.requirements,
                    dependencies=[],  # Will be updated with architect task ID
                    status=TaskStatus.PENDING
                )
            ])
            
            # Set up dependencies
            if len(tasks) >= 4:
                tasks[1].dependencies = [tasks[0].task_id]  # Architecture depends on planning
                tasks[2].dependencies = [tasks[1].task_id]  # Backend depends on architecture
                tasks[3].dependencies = [tasks[1].task_id]  # Frontend depends on architecture
        
        elif session.session_type == "code_review":
            tasks.append(
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.ARCHITECT,
                    task_type="code_review",
                    description="Review code quality and architecture",
                    requirements=session.requirements,
                    dependencies=[],
                    status=TaskStatus.PENDING
                )
            )
        
        elif session.session_type == "debugging":
            tasks.append(
                AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_type=AgentType.BACKEND,  # or FRONTEND based on code type
                    task_type="debug_assistance",
                    description="Debug code issues and provide solutions",
                    requirements=session.requirements,
                    dependencies=[],
                    status=TaskStatus.PENDING
                )
            )
        
        return tasks
    
    async def _execute_session_tasks(self, session_id: str):
        """Execute tasks for a session"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                return
            
            # Execute tasks based on dependencies
            completed_tasks = set()
            
            while len(completed_tasks) < len(session.tasks):
                # Find tasks that can be executed (dependencies met)
                ready_tasks = [
                    task for task in session.tasks
                    if (task.status == TaskStatus.PENDING and
                        all(dep_id in completed_tasks for dep_id in task.dependencies))
                ]
                
                if not ready_tasks:
                    # Check if we're stuck due to failed dependencies
                    failed_tasks = [task for task in session.tasks if task.status == TaskStatus.FAILED]
                    if failed_tasks:
                        self.logger.error(f"Session {session_id} stuck due to failed tasks")
                        session.status = "failed"
                        break
                    
                    # Wait for running tasks to complete
                    await asyncio.sleep(1)
                    continue
                
                # Execute ready tasks in parallel
                execute_tasks = []
                for task in ready_tasks:
                    task.status = TaskStatus.RUNNING
                    task.started_at = datetime.now()
                    execute_tasks.append(self._execute_task(task))
                
                if execute_tasks:
                    await asyncio.gather(*execute_tasks, return_exceptions=True)
                
                # Update completed tasks
                for task in session.tasks:
                    if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                        completed_tasks.add(task.task_id)
                
                # Update session progress
                session.progress = len(completed_tasks) / len(session.tasks)
                session.updated_at = datetime.now()
            
            # Update final session status
            failed_tasks = [task for task in session.tasks if task.status == TaskStatus.FAILED]
            if failed_tasks:
                session.status = "failed"
            else:
                session.status = "completed"
            
            session.updated_at = datetime.now()
            self.logger.info(f"Session {session_id} completed with status: {session.status}")
        
        except Exception as e:
            self.logger.error(f"Error executing session {session_id}: {e}")
            if session_id in self.sessions:
                self.sessions[session_id].status = "error"
    
    async def _execute_task(self, task: AgentTask):
        """Execute a single task"""
        try:
            self.logger.info(f"Executing task {task.task_id}: {task.description}")
            
            # Get the appropriate prompt for the agent type and task type
            prompt_template = self.agent_prompts.get(task.agent_type, {}).get(task.task_type)
            
            if not prompt_template:
                raise ValueError(f"No prompt template for {task.agent_type.value}.{task.task_type}")
            
            # Format the prompt with task requirements
            prompt = prompt_template.format(**task.requirements)
            
            # Generate response using LLM
            response = await llm_manager.generate(
                prompt=prompt,
                temperature=0.3,  # Lower temperature for more consistent results
                max_tokens=4000
            )
            
            # Parse and store result
            task.result = {
                "output": response.content,
                "usage": response.usage,
                "model": response.model,
                "timestamp": datetime.now().isoformat()
            }
            
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            
            self.logger.info(f"Task {task.task_id} completed successfully")
        
        except Exception as e:
            self.logger.error(f"Task {task.task_id} failed: {e}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now()
    
    async def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return [
            session_id for session_id, session in self.sessions.items()
            if session.status in ["active", "running"]
        ]
    
    async def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get status of a specific session"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        return {
            "session_id": session.session_id,
            "status": session.status,
            "progress": session.progress,
            "total_tasks": len(session.tasks),
            "completed_tasks": len([t for t in session.tasks if t.status == TaskStatus.COMPLETED]),
            "failed_tasks": len([t for t in session.tasks if t.status == TaskStatus.FAILED]),
            "tasks": [asdict(task) for task in session.tasks],
            "updated_at": session.updated_at.isoformat() if session.updated_at else None
        }
    
    async def cancel_session(self, session_id: str):
        """Cancel an active session"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        session.status = "cancelled"
        
        # Cancel running tasks
        for task in session.tasks:
            if task.status == TaskStatus.RUNNING:
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.now()
        
        self.logger.info(f"Session {session_id} cancelled")
    
    async def get_task_result(self, session_id: str, task_id: str) -> Dict[str, Any]:
        """Get result of a specific task"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        task = next((t for t in session.tasks if t.task_id == task_id), None)
        if not task:
            raise ValueError(f"Task {task_id} not found in session {session_id}")
        
        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "result": task.result,
            "error": task.error,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of the agent manager"""
        try:
            active_sessions_count = len([s for s in self.sessions.values() if s.status == "active"])
            running_tasks_count = len(self.active_tasks)
            
            return {
                "status": "healthy",
                "active_sessions": active_sessions_count,
                "running_tasks": running_tasks_count,
                "total_sessions": len(self.sessions),
                "agent_types": [agent_type.value for agent_type in AgentType],
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global instance
agent_manager = AgentManager()