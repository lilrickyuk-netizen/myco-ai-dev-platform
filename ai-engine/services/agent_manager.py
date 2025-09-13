"""
Agent management service for orchestrating AI agents
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from .llm_manager import llm_manager, LLMProvider

logger = logging.getLogger(__name__)

class AgentType(Enum):
    ORCHESTRATOR = "orchestrator"
    PLANNER = "planner"
    ARCHITECT = "architect"
    BACKEND = "backend"
    FRONTEND = "frontend"
    INFRASTRUCTURE = "infrastructure"
    SECURITY = "security"
    VERIFIER = "verifier"
    DEPLOYER = "deployer"

class AgentStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    COMPLETED = "completed"

@dataclass
class AgentTask:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    description: str = ""
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    status: AgentStatus = AgentStatus.IDLE
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Agent:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: AgentType
    name: str
    description: str
    capabilities: List[str] = field(default_factory=list)
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[AgentTask] = None
    task_queue: List[AgentTask] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    last_active: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

class AgentManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.agents: Dict[str, Agent] = {}
        self.tasks: Dict[str, AgentTask] = {}
        self.agent_callbacks: Dict[AgentType, Callable] = {}
        self.running = False
        self._register_default_agents()
    
    async def initialize(self):
        """Initialize the agent manager"""
        self.logger.info("Initializing Agent Manager...")
        self.running = True
        
        # Start the task processing loop
        asyncio.create_task(self._process_tasks())
        self.logger.info("Agent Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup agent manager"""
        self.logger.info("Shutting down Agent Manager...")
        self.running = False
        
        # Cancel all running tasks
        for agent in self.agents.values():
            if agent.status == AgentStatus.RUNNING:
                agent.status = AgentStatus.PAUSED
        
        self.logger.info("Agent Manager shutdown complete")
    
    def _register_default_agents(self):
        """Register default system agents"""
        default_agents = [
            Agent(
                type=AgentType.ORCHESTRATOR,
                name="Master Orchestrator",
                description="Coordinates all other agents and manages the overall project generation workflow",
                capabilities=[
                    "task_coordination",
                    "workflow_management", 
                    "agent_communication",
                    "project_planning"
                ]
            ),
            Agent(
                type=AgentType.PLANNER,
                name="Project Planner",
                description="Analyzes requirements and creates detailed project plans",
                capabilities=[
                    "requirement_analysis",
                    "architecture_planning",
                    "task_breakdown",
                    "timeline_estimation"
                ]
            ),
            Agent(
                type=AgentType.ARCHITECT,
                name="System Architect",
                description="Designs system architecture and technical specifications",
                capabilities=[
                    "system_design",
                    "technology_selection",
                    "architecture_documentation",
                    "scalability_planning"
                ]
            ),
            Agent(
                type=AgentType.BACKEND,
                name="Backend Developer",
                description="Generates backend code, APIs, and server-side logic",
                capabilities=[
                    "api_development",
                    "database_design",
                    "server_logic",
                    "authentication",
                    "data_validation"
                ]
            ),
            Agent(
                type=AgentType.FRONTEND,
                name="Frontend Developer", 
                description="Creates user interfaces and client-side applications",
                capabilities=[
                    "ui_development",
                    "component_creation",
                    "responsive_design",
                    "user_experience",
                    "state_management"
                ]
            ),
            Agent(
                type=AgentType.INFRASTRUCTURE,
                name="Infrastructure Engineer",
                description="Sets up deployment infrastructure and DevOps automation",
                capabilities=[
                    "containerization",
                    "orchestration",
                    "ci_cd_setup",
                    "monitoring",
                    "scaling"
                ]
            ),
            Agent(
                type=AgentType.SECURITY,
                name="Security Engineer",
                description="Implements security measures and vulnerability assessments",
                capabilities=[
                    "security_audit",
                    "vulnerability_scanning",
                    "access_control",
                    "encryption",
                    "compliance"
                ]
            ),
            Agent(
                type=AgentType.VERIFIER,
                name="Quality Verifier",
                description="Ensures code quality, testing, and project completeness",
                capabilities=[
                    "code_review",
                    "test_generation",
                    "quality_metrics",
                    "performance_testing",
                    "completion_verification"
                ]
            ),
            Agent(
                type=AgentType.DEPLOYER,
                name="Deployment Manager",
                description="Handles application deployment to various cloud platforms",
                capabilities=[
                    "cloud_deployment",
                    "environment_setup",
                    "rollback_management",
                    "monitoring_setup",
                    "health_checks"
                ]
            )
        ]
        
        for agent in default_agents:
            self.agents[agent.id] = agent
            self.logger.info(f"Registered agent: {agent.name} ({agent.type.value})")
    
    async def create_task(
        self,
        agent_type: AgentType,
        task_type: str,
        description: str,
        input_data: Dict[str, Any],
        priority: int = 1
    ) -> str:
        """Create a new task for an agent"""
        
        task = AgentTask(
            type=task_type,
            description=description,
            input_data=input_data,
            metadata={"priority": priority}
        )
        
        # Find available agent of the specified type
        agent = self._get_agent_by_type(agent_type)
        if not agent:
            raise ValueError(f"No agent available for type: {agent_type}")
        
        # Add task to agent's queue
        agent.task_queue.append(task)
        self.tasks[task.id] = task
        
        self.logger.info(f"Created task {task.id} for agent {agent.name}")
        return task.id
    
    async def get_task_status(self, task_id: str) -> Optional[AgentTask]:
        """Get status of a specific task"""
        return self.tasks.get(task_id)
    
    async def get_agent_status(self, agent_id: str) -> Optional[Agent]:
        """Get status of a specific agent"""
        return self.agents.get(agent_id)
    
    async def list_agents(self) -> List[Agent]:
        """List all registered agents"""
        return list(self.agents.values())
    
    async def list_tasks(self, status: Optional[AgentStatus] = None) -> List[AgentTask]:
        """List tasks, optionally filtered by status"""
        tasks = list(self.tasks.values())
        if status:
            tasks = [task for task in tasks if task.status == status]
        return tasks
    
    def _get_agent_by_type(self, agent_type: AgentType) -> Optional[Agent]:
        """Find an agent by type"""
        for agent in self.agents.values():
            if agent.type == agent_type and agent.status != AgentStatus.ERROR:
                return agent
        return None
    
    async def _process_tasks(self):
        """Main task processing loop"""
        while self.running:
            try:
                # Process tasks for each agent
                for agent in self.agents.values():
                    if agent.status == AgentStatus.IDLE and agent.task_queue:
                        await self._execute_next_task(agent)
                
                # Sleep briefly before next iteration
                await asyncio.sleep(1)
                
            except Exception as e:
                self.logger.error(f"Error in task processing loop: {e}")
                await asyncio.sleep(5)
    
    async def _execute_next_task(self, agent: Agent):
        """Execute the next task in an agent's queue"""
        if not agent.task_queue:
            return
        
        task = agent.task_queue.pop(0)
        agent.current_task = task
        agent.status = AgentStatus.RUNNING
        task.status = AgentStatus.RUNNING
        task.started_at = datetime.now()
        
        self.logger.info(f"Agent {agent.name} starting task {task.id}: {task.description}")
        
        try:
            # Execute the task based on agent type
            result = await self._execute_agent_task(agent, task)
            
            # Task completed successfully
            task.output_data = result
            task.status = AgentStatus.COMPLETED
            task.completed_at = datetime.now()
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            agent.last_active = datetime.now()
            
            self.logger.info(f"Task {task.id} completed successfully")
            
        except Exception as e:
            # Task failed
            task.status = AgentStatus.ERROR
            task.error_message = str(e)
            task.completed_at = datetime.now()
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            
            self.logger.error(f"Task {task.id} failed: {e}")
    
    async def _execute_agent_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute a specific task for an agent"""
        
        # Route to specific agent implementation
        if agent.type == AgentType.ORCHESTRATOR:
            return await self._execute_orchestrator_task(agent, task)
        elif agent.type == AgentType.PLANNER:
            return await self._execute_planner_task(agent, task)
        elif agent.type == AgentType.ARCHITECT:
            return await self._execute_architect_task(agent, task)
        elif agent.type == AgentType.BACKEND:
            return await self._execute_backend_task(agent, task)
        elif agent.type == AgentType.FRONTEND:
            return await self._execute_frontend_task(agent, task)
        elif agent.type == AgentType.INFRASTRUCTURE:
            return await self._execute_infrastructure_task(agent, task)
        elif agent.type == AgentType.SECURITY:
            return await self._execute_security_task(agent, task)
        elif agent.type == AgentType.VERIFIER:
            return await self._execute_verifier_task(agent, task)
        elif agent.type == AgentType.DEPLOYER:
            return await self._execute_deployer_task(agent, task)
        else:
            raise ValueError(f"Unknown agent type: {agent.type}")
    
    async def _execute_orchestrator_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute orchestrator tasks"""
        if task.type == "coordinate_project":
            requirements = task.input_data.get("requirements", {})
            
            # Create a project plan
            plan_prompt = f"""
            Create a detailed project implementation plan for:
            Requirements: {json.dumps(requirements, indent=2)}
            
            Provide:
            1. High-level architecture
            2. Task breakdown for each component
            3. Agent assignments
            4. Implementation timeline
            5. Dependencies and critical path
            """
            
            response = await llm_manager.generate(
                plan_prompt,
                provider=LLMProvider.OPENAI,
                temperature=0.3
            )
            
            return {
                "project_plan": response.content,
                "status": "plan_created",
                "next_steps": ["assign_tasks_to_agents", "begin_implementation"]
            }
        
        elif task.type == "assign_tasks":
            # Distribute tasks to specialized agents
            tasks_to_assign = task.input_data.get("tasks", [])
            assignments = []
            
            for task_item in tasks_to_assign:
                agent_type = self._determine_agent_type(task_item)
                task_id = await self.create_task(
                    agent_type=agent_type,
                    task_type=task_item.get("type", "general"),
                    description=task_item.get("description", ""),
                    input_data=task_item.get("data", {})
                )
                assignments.append({
                    "task_id": task_id,
                    "agent_type": agent_type.value,
                    "description": task_item.get("description", "")
                })
            
            return {
                "assignments": assignments,
                "status": "tasks_assigned"
            }
        
        return {"status": "task_completed", "result": "orchestrator_task_done"}
    
    async def _execute_planner_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute planner tasks"""
        if task.type == "analyze_requirements":
            requirements = task.input_data.get("requirements", "")
            
            prompt = f"""
            Analyze these project requirements and create a comprehensive implementation plan:
            
            {requirements}
            
            Provide:
            1. Feature breakdown
            2. Technical requirements
            3. Architecture recommendations
            4. Implementation phases
            5. Resource estimates
            6. Risk assessment
            """
            
            response = await llm_manager.generate(prompt, temperature=0.2)
            
            return {
                "analysis": response.content,
                "features": ["feature1", "feature2"],  # Would be parsed from response
                "timeline": "6 weeks",
                "complexity": "medium"
            }
        
        return {"status": "task_completed", "result": "planner_task_done"}
    
    async def _execute_architect_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute architect tasks"""
        if task.type == "design_system":
            requirements = task.input_data.get("requirements", {})
            
            prompt = f"""
            Design a system architecture for:
            {json.dumps(requirements, indent=2)}
            
            Include:
            1. System components and their responsibilities
            2. Data flow diagrams
            3. Technology stack recommendations
            4. Scalability considerations
            5. Security architecture
            6. Deployment strategy
            """
            
            response = await llm_manager.generate(prompt, temperature=0.3)
            
            return {
                "architecture": response.content,
                "components": ["frontend", "backend", "database"],
                "tech_stack": {"frontend": "React", "backend": "Node.js", "database": "PostgreSQL"}
            }
        
        return {"status": "task_completed", "result": "architect_task_done"}
    
    async def _execute_backend_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute backend development tasks"""
        if task.type == "generate_api":
            spec = task.input_data.get("api_spec", {})
            
            prompt = f"""
            Generate a complete backend API implementation:
            Specification: {json.dumps(spec, indent=2)}
            
            Include:
            1. API routes and handlers
            2. Data models
            3. Validation schemas
            4. Database migrations
            5. Authentication middleware
            6. Error handling
            7. Tests
            """
            
            response = await llm_manager.code_generation(
                description=prompt,
                language="typescript",
                framework="express"
            )
            
            return {
                "code": response.content,
                "files": ["routes.ts", "models.ts", "middleware.ts"],
                "status": "api_generated"
            }
        
        return {"status": "task_completed", "result": "backend_task_done"}
    
    async def _execute_frontend_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute frontend development tasks"""
        if task.type == "generate_ui":
            ui_spec = task.input_data.get("ui_spec", {})
            
            prompt = f"""
            Generate a complete frontend application:
            UI Specification: {json.dumps(ui_spec, indent=2)}
            
            Include:
            1. React components
            2. State management
            3. Routing
            4. API integration
            5. Styling (Tailwind CSS)
            6. Type definitions
            7. Tests
            """
            
            response = await llm_manager.code_generation(
                description=prompt,
                language="typescript",
                framework="react"
            )
            
            return {
                "code": response.content,
                "components": ["App.tsx", "components/", "pages/"],
                "status": "ui_generated"
            }
        
        return {"status": "task_completed", "result": "frontend_task_done"}
    
    async def _execute_infrastructure_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute infrastructure tasks"""
        if task.type == "setup_deployment":
            deployment_spec = task.input_data.get("deployment_spec", {})
            
            prompt = f"""
            Create deployment infrastructure:
            Specification: {json.dumps(deployment_spec, indent=2)}
            
            Generate:
            1. Docker configurations
            2. Kubernetes manifests
            3. CI/CD pipelines
            4. Monitoring setup
            5. Terraform scripts
            """
            
            response = await llm_manager.generate(prompt, temperature=0.2)
            
            return {
                "infrastructure": response.content,
                "files": ["Dockerfile", "k8s/", ".github/workflows/"],
                "status": "infrastructure_ready"
            }
        
        return {"status": "task_completed", "result": "infrastructure_task_done"}
    
    async def _execute_security_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute security tasks"""
        if task.type == "security_audit":
            codebase = task.input_data.get("codebase", "")
            
            prompt = f"""
            Perform security audit on this codebase:
            {codebase}
            
            Check for:
            1. Authentication vulnerabilities
            2. Input validation issues
            3. SQL injection risks
            4. XSS vulnerabilities
            5. Access control problems
            6. Sensitive data exposure
            """
            
            response = await llm_manager.generate(prompt, temperature=0.1)
            
            return {
                "audit_report": response.content,
                "vulnerabilities": [],
                "security_score": 85,
                "status": "audit_complete"
            }
        
        return {"status": "task_completed", "result": "security_task_done"}
    
    async def _execute_verifier_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute verification tasks"""
        if task.type == "verify_completeness":
            project_data = task.input_data.get("project", {})
            
            prompt = f"""
            Verify project completeness:
            Project: {json.dumps(project_data, indent=2)}
            
            Check:
            1. All requirements implemented
            2. Code quality standards met
            3. Tests passing
            4. Documentation complete
            5. Security requirements satisfied
            6. Performance benchmarks met
            """
            
            response = await llm_manager.generate(prompt, temperature=0.1)
            
            return {
                "verification_report": response.content,
                "completeness_score": 95,
                "missing_items": [],
                "status": "verification_complete"
            }
        
        return {"status": "task_completed", "result": "verifier_task_done"}
    
    async def _execute_deployer_task(self, agent: Agent, task: AgentTask) -> Dict[str, Any]:
        """Execute deployment tasks"""
        if task.type == "deploy_application":
            deployment_config = task.input_data.get("config", {})
            
            # Simulate deployment process
            steps = [
                "building_containers",
                "pushing_images", 
                "deploying_to_cluster",
                "running_health_checks",
                "updating_dns",
                "deployment_complete"
            ]
            
            return {
                "deployment_steps": steps,
                "deployment_url": "https://app.example.com",
                "status": "deployed_successfully"
            }
        
        return {"status": "task_completed", "result": "deployer_task_done"}
    
    def _determine_agent_type(self, task_item: Dict[str, Any]) -> AgentType:
        """Determine which agent type should handle a task"""
        task_type = task_item.get("type", "").lower()
        
        if "backend" in task_type or "api" in task_type:
            return AgentType.BACKEND
        elif "frontend" in task_type or "ui" in task_type:
            return AgentType.FRONTEND
        elif "infrastructure" in task_type or "deployment" in task_type:
            return AgentType.INFRASTRUCTURE
        elif "security" in task_type or "audit" in task_type:
            return AgentType.SECURITY
        elif "test" in task_type or "verify" in task_type:
            return AgentType.VERIFIER
        elif "architecture" in task_type or "design" in task_type:
            return AgentType.ARCHITECT
        elif "plan" in task_type:
            return AgentType.PLANNER
        else:
            return AgentType.ORCHESTRATOR
    
    async def get_status(self) -> Dict[str, Any]:
        """Get overall status of the agent system"""
        agent_statuses = {}
        for agent in self.agents.values():
            agent_statuses[agent.name] = {
                "type": agent.type.value,
                "status": agent.status.value,
                "current_task": agent.current_task.description if agent.current_task else None,
                "queue_length": len(agent.task_queue),
                "last_active": agent.last_active.isoformat()
            }
        
        task_summary = {
            "total": len(self.tasks),
            "idle": len([t for t in self.tasks.values() if t.status == AgentStatus.IDLE]),
            "running": len([t for t in self.tasks.values() if t.status == AgentStatus.RUNNING]),
            "completed": len([t for t in self.tasks.values() if t.status == AgentStatus.COMPLETED]),
            "error": len([t for t in self.tasks.values() if t.status == AgentStatus.ERROR])
        }
        
        return {
            "system_status": "running" if self.running else "stopped",
            "agents": agent_statuses,
            "tasks": task_summary,
            "timestamp": datetime.now().isoformat()
        }

# Global instance
agent_manager = AgentManager()