import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from .base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext, AgentStatus

class OrchestratorAgent(BaseAgent):
    def __init__(self):
        super().__init__("orchestrator-001", AgentType.ORCHESTRATOR)
        self.capabilities = [
            "task_planning",
            "agent_coordination",
            "workflow_management",
            "resource_allocation",
            "quality_assurance"
        ]
        self.agents: Dict[str, BaseAgent] = {}
        self.task_queue: List[Task] = []
        self.completed_tasks: List[Task] = []
        self.workflow_state = {}
        self.logger = logging.getLogger(__name__)
        
    def register_agent(self, agent: BaseAgent):
        """Register a specialized agent with the orchestrator"""
        self.agents[agent.agent_id] = agent
        self.logger.info(f"Registered agent: {agent.agent_id} ({agent.agent_type.value})")
    
    def can_handle_task(self, task: Task) -> bool:
        return task.type in ["orchestrate", "coordinate", "plan_workflow"]
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute orchestration tasks"""
        if task.type == "orchestrate":
            return await self._orchestrate_project(task, context)
        elif task.type == "coordinate":
            return await self._coordinate_agents(task, context)
        elif task.type == "plan_workflow":
            return await self._plan_workflow(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _orchestrate_project(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Main orchestration logic for complete project generation"""
        self.logger.info(f"Starting project orchestration for: {context.project_id}")
        
        # Phase 1: Analysis and Planning
        planning_tasks = await self._create_planning_tasks(context)
        planning_results = await self._execute_task_batch(planning_tasks, context)
        
        # Phase 2: Architecture Design
        architecture_tasks = await self._create_architecture_tasks(planning_results, context)
        architecture_results = await self._execute_task_batch(architecture_tasks, context)
        
        # Phase 3: Parallel Development
        development_tasks = await self._create_development_tasks(architecture_results, context)
        development_results = await self._execute_parallel_tasks(development_tasks, context)
        
        # Phase 4: Integration and Testing
        integration_tasks = await self._create_integration_tasks(development_results, context)
        integration_results = await self._execute_task_batch(integration_tasks, context)
        
        # Phase 5: Security and Compliance
        security_tasks = await self._create_security_tasks(integration_results, context)
        security_results = await self._execute_task_batch(security_tasks, context)
        
        # Phase 6: Deployment and Monitoring
        deployment_tasks = await self._create_deployment_tasks(security_results, context)
        deployment_results = await self._execute_task_batch(deployment_tasks, context)
        
        # Phase 7: Verification and Documentation
        verification_tasks = await self._create_verification_tasks(deployment_results, context)
        verification_results = await self._execute_task_batch(verification_tasks, context)
        
        return {
            "project_id": context.project_id,
            "status": "completed",
            "phases": {
                "planning": planning_results,
                "architecture": architecture_results,
                "development": development_results,
                "integration": integration_results,
                "security": security_results,
                "deployment": deployment_results,
                "verification": verification_results
            },
            "completion_time": datetime.utcnow().isoformat(),
            "quality_score": await self._calculate_quality_score(verification_results)
        }
    
    async def _create_planning_tasks(self, context: AgentExecutionContext) -> List[Task]:
        """Create planning phase tasks"""
        tasks = []
        
        # Requirements analysis
        tasks.append(Task(
            id=f"req-analysis-{uuid.uuid4().hex[:8]}",
            type="analyze_requirements",
            description="Analyze and validate project requirements",
            priority=TaskPriority.CRITICAL,
            inputs={"requirements": context.requirements}
        ))
        
        # Technology stack validation
        tasks.append(Task(
            id=f"tech-validation-{uuid.uuid4().hex[:8]}",
            type="validate_tech_stack",
            description="Validate and optimize technology stack",
            priority=TaskPriority.HIGH,
            inputs={"tech_stack": context.tech_stack, "project_type": context.project_type}
        ))
        
        # Project structure planning
        tasks.append(Task(
            id=f"structure-planning-{uuid.uuid4().hex[:8]}",
            type="plan_project_structure",
            description="Plan project directory structure and organization",
            priority=TaskPriority.HIGH,
            inputs={"project_type": context.project_type, "tech_stack": context.tech_stack}
        ))
        
        return tasks
    
    async def _create_architecture_tasks(self, planning_results: Dict[str, Any], context: AgentExecutionContext) -> List[Task]:
        """Create architecture design tasks"""
        tasks = []
        
        # System architecture design
        tasks.append(Task(
            id=f"system-arch-{uuid.uuid4().hex[:8]}",
            type="design_system_architecture",
            description="Design overall system architecture",
            priority=TaskPriority.CRITICAL,
            inputs={"planning_results": planning_results, "requirements": context.requirements}
        ))
        
        # Database design
        tasks.append(Task(
            id=f"db-design-{uuid.uuid4().hex[:8]}",
            type="design_database",
            description="Design database schema and relationships",
            priority=TaskPriority.HIGH,
            inputs={"requirements": context.requirements, "tech_stack": context.tech_stack}
        ))
        
        # API design
        tasks.append(Task(
            id=f"api-design-{uuid.uuid4().hex[:8]}",
            type="design_api",
            description="Design REST API endpoints and contracts",
            priority=TaskPriority.HIGH,
            inputs={"requirements": context.requirements, "system_architecture": planning_results}
        ))
        
        return tasks
    
    async def _create_development_tasks(self, architecture_results: Dict[str, Any], context: AgentExecutionContext) -> List[Task]:
        """Create development phase tasks (can run in parallel)"""
        tasks = []
        
        # Backend development
        tasks.append(Task(
            id=f"backend-dev-{uuid.uuid4().hex[:8]}",
            type="develop_backend",
            description="Generate complete backend implementation",
            priority=TaskPriority.CRITICAL,
            inputs={"architecture": architecture_results, "requirements": context.requirements}
        ))
        
        # Frontend development
        tasks.append(Task(
            id=f"frontend-dev-{uuid.uuid4().hex[:8]}",
            type="develop_frontend",
            description="Generate complete frontend implementation",
            priority=TaskPriority.CRITICAL,
            inputs={"architecture": architecture_results, "requirements": context.requirements}
        ))
        
        # Infrastructure setup
        tasks.append(Task(
            id=f"infra-setup-{uuid.uuid4().hex[:8]}",
            type="setup_infrastructure",
            description="Generate infrastructure as code",
            priority=TaskPriority.HIGH,
            inputs={"architecture": architecture_results, "deployment_requirements": context.configuration}
        ))
        
        return tasks
    
    async def _execute_task_batch(self, tasks: List[Task], context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute tasks sequentially in a batch"""
        results = {}
        
        for task in tasks:
            agent = self._find_suitable_agent(task)
            if not agent:
                raise RuntimeError(f"No suitable agent found for task: {task.type}")
            
            self.logger.info(f"Executing task {task.id} with agent {agent.agent_id}")
            result = await agent.start_task(task, context)
            results[task.id] = result
            self.completed_tasks.append(task)
        
        return results
    
    async def _execute_parallel_tasks(self, tasks: List[Task], context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute tasks in parallel"""
        task_futures = []
        
        for task in tasks:
            agent = self._find_suitable_agent(task)
            if not agent:
                raise RuntimeError(f"No suitable agent found for task: {task.type}")
            
            future = asyncio.create_task(agent.start_task(task, context))
            task_futures.append((task.id, future))
        
        results = {}
        for task_id, future in task_futures:
            try:
                result = await future
                results[task_id] = result
            except Exception as e:
                self.logger.error(f"Task {task_id} failed: {str(e)}")
                results[task_id] = {"error": str(e)}
        
        return results
    
    def _find_suitable_agent(self, task: Task) -> Optional[BaseAgent]:
        """Find the most suitable agent for a task"""
        suitable_agents = []
        
        for agent in self.agents.values():
            if agent.can_handle_task(task) and agent.status == AgentStatus.IDLE:
                suitable_agents.append(agent)
        
        if not suitable_agents:
            return None
        
        # Select agent with best performance metrics
        return max(suitable_agents, key=lambda a: a.performance_metrics["success_rate"])
    
    async def _calculate_quality_score(self, verification_results: Dict[str, Any]) -> float:
        """Calculate overall project quality score"""
        scores = []
        
        for result in verification_results.values():
            if isinstance(result, dict) and "quality_score" in result:
                scores.append(result["quality_score"])
        
        return sum(scores) / len(scores) if scores else 0.0
    
    async def get_project_status(self, project_id: str) -> Dict[str, Any]:
        """Get current status of project generation"""
        return {
            "project_id": project_id,
            "orchestrator_status": self.status.value,
            "active_agents": [
                agent.get_status() for agent in self.agents.values() 
                if agent.status == AgentStatus.WORKING
            ],
            "completed_tasks": len(self.completed_tasks),
            "pending_tasks": len(self.task_queue),
            "workflow_state": self.workflow_state
        }