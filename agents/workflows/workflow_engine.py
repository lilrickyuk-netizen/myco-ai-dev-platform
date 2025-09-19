import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

from ..base_agent import BaseAgent, Task, TaskPriority, AgentExecutionContext, AgentStatus
from ..orchestrator.orchestrator_agent import OrchestratorAgent
from ..planner.planner_agent import PlannerAgent
from ..architecture.architecture_agent import ArchitectureAgent
from ..backend.enhanced_backend_agent import BackendAgent
from ..frontend.frontend_agent import FrontendAgent

class WorkflowStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class WorkflowStep:
    id: str
    name: str
    agent_type: str
    task_type: str
    inputs: Dict[str, Any]
    dependencies: List[str] = None
    timeout: int = 300
    retry_count: int = 3
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class Workflow:
    id: str
    name: str
    description: str
    steps: List[WorkflowStep]
    context: AgentExecutionContext
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.results is None:
            self.results = {}

class WorkflowEngine:
    """Engine for executing multi-agent workflows"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_workflows: Dict[str, Workflow] = {}
        self.agents: Dict[str, BaseAgent] = {}
        self._initialize_agents()
        
    def _initialize_agents(self):
        """Initialize all available agents"""
        self.agents = {
            "orchestrator": OrchestratorAgent(),
            "planner": PlannerAgent(),
            "architecture": ArchitectureAgent(),
            "backend": BackendAgent(),
            "frontend": FrontendAgent()
        }
        self.logger.info(f"Initialized {len(self.agents)} agents")
    
    def create_workflow(self, name: str, description: str, steps: List[Dict], context: AgentExecutionContext) -> str:
        """Create a new workflow"""
        workflow_id = f"workflow_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        workflow_steps = []
        for step_data in steps:
            step = WorkflowStep(
                id=step_data["id"],
                name=step_data["name"],
                agent_type=step_data["agent_type"],
                task_type=step_data["task_type"],
                inputs=step_data.get("inputs", {}),
                dependencies=step_data.get("dependencies", []),
                timeout=step_data.get("timeout", 300),
                retry_count=step_data.get("retry_count", 3)
            )
            workflow_steps.append(step)
        
        workflow = Workflow(
            id=workflow_id,
            name=name,
            description=description,
            steps=workflow_steps,
            context=context
        )
        
        self.active_workflows[workflow_id] = workflow
        self.logger.info(f"Created workflow: {workflow_id} - {name}")
        return workflow_id
    
    async def execute_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Execute a workflow"""
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        workflow.status = WorkflowStatus.RUNNING
        workflow.started_at = datetime.utcnow()
        
        self.logger.info(f"Starting workflow execution: {workflow_id}")
        
        try:
            # Build dependency graph
            dependency_graph = self._build_dependency_graph(workflow.steps)
            
            # Execute steps in dependency order
            execution_order = self._calculate_execution_order(dependency_graph)
            
            for step_batch in execution_order:
                # Execute steps in parallel if they have no dependencies between them
                tasks = []
                for step_id in step_batch:
                    step = next(s for s in workflow.steps if s.id == step_id)
                    task = self._execute_step(step, workflow)
                    tasks.append(task)
                
                # Wait for all steps in batch to complete
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Check for failures
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        step_id = step_batch[i]
                        step = next(s for s in workflow.steps if s.id == step_id)
                        step.status = "failed"
                        step.error = str(result)
                        step.completed_at = datetime.utcnow()
                        
                        workflow.status = WorkflowStatus.FAILED
                        workflow.completed_at = datetime.utcnow()
                        self.logger.error(f"Workflow {workflow_id} failed at step {step_id}: {result}")
                        return self._get_workflow_results(workflow)
            
            workflow.status = WorkflowStatus.COMPLETED
            workflow.completed_at = datetime.utcnow()
            self.logger.info(f"Workflow {workflow_id} completed successfully")
            
            return self._get_workflow_results(workflow)
            
        except Exception as e:
            workflow.status = WorkflowStatus.FAILED
            workflow.completed_at = datetime.utcnow()
            self.logger.error(f"Workflow {workflow_id} execution failed: {e}")
            raise
    
    async def _execute_step(self, step: WorkflowStep, workflow: Workflow) -> Dict[str, Any]:
        """Execute a single workflow step"""
        step.status = "running"
        step.started_at = datetime.utcnow()
        
        self.logger.info(f"Executing step: {step.id} - {step.name}")
        
        try:
            # Get the appropriate agent
            agent = self.agents.get(step.agent_type)
            if not agent:
                raise ValueError(f"Agent not found: {step.agent_type}")
            
            # Resolve input dependencies
            resolved_inputs = self._resolve_step_inputs(step, workflow)
            
            # Create task
            task = Task(
                id=f"{workflow.id}_{step.id}",
                type=step.task_type,
                description=f"Workflow step: {step.name}",
                priority=TaskPriority.HIGH,
                inputs=resolved_inputs
            )
            
            # Execute task with timeout
            result = await asyncio.wait_for(
                agent.start_task(task, workflow.context),
                timeout=step.timeout
            )
            
            step.status = "completed"
            step.result = result
            step.completed_at = datetime.utcnow()
            
            # Store result in workflow context for dependency resolution
            workflow.results[step.id] = result
            
            self.logger.info(f"Step completed: {step.id}")
            return result
            
        except asyncio.TimeoutError:
            step.status = "failed"
            step.error = f"Step timed out after {step.timeout} seconds"
            step.completed_at = datetime.utcnow()
            self.logger.error(f"Step {step.id} timed out")
            raise
        except Exception as e:
            step.status = "failed"
            step.error = str(e)
            step.completed_at = datetime.utcnow()
            self.logger.error(f"Step {step.id} failed: {e}")
            raise
    
    def _resolve_step_inputs(self, step: WorkflowStep, workflow: Workflow) -> Dict[str, Any]:
        """Resolve step inputs from previous step results"""
        resolved_inputs = step.inputs.copy()
        
        # Replace placeholders with actual results from previous steps
        for key, value in resolved_inputs.items():
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                # Extract reference (e.g., "${step1.result.api_design}")
                reference = value[2:-1]
                parts = reference.split(".")
                
                if len(parts) >= 2:
                    step_id = parts[0]
                    result_path = parts[1:]
                    
                    if step_id in workflow.results:
                        result = workflow.results[step_id]
                        for part in result_path:
                            if isinstance(result, dict) and part in result:
                                result = result[part]
                            else:
                                self.logger.warning(f"Could not resolve reference: {reference}")
                                break
                        else:
                            resolved_inputs[key] = result
        
        return resolved_inputs
    
    def _build_dependency_graph(self, steps: List[WorkflowStep]) -> Dict[str, List[str]]:
        """Build dependency graph from workflow steps"""
        graph = {}
        for step in steps:
            graph[step.id] = step.dependencies.copy()
        return graph
    
    def _calculate_execution_order(self, dependency_graph: Dict[str, List[str]]) -> List[List[str]]:
        """Calculate execution order using topological sort"""
        execution_order = []
        remaining_nodes = set(dependency_graph.keys())
        
        while remaining_nodes:
            # Find nodes with no remaining dependencies
            ready_nodes = []
            for node in remaining_nodes:
                if not any(dep in remaining_nodes for dep in dependency_graph[node]):
                    ready_nodes.append(node)
            
            if not ready_nodes:
                raise ValueError("Circular dependency detected in workflow")
            
            execution_order.append(ready_nodes)
            remaining_nodes -= set(ready_nodes)
        
        return execution_order
    
    def _get_workflow_results(self, workflow: Workflow) -> Dict[str, Any]:
        """Get comprehensive workflow results"""
        return {
            "workflow_id": workflow.id,
            "name": workflow.name,
            "status": workflow.status.value,
            "started_at": workflow.started_at.isoformat() if workflow.started_at else None,
            "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else None,
            "duration_seconds": (
                (workflow.completed_at - workflow.started_at).total_seconds()
                if workflow.started_at and workflow.completed_at
                else None
            ),
            "steps": [
                {
                    "id": step.id,
                    "name": step.name,
                    "status": step.status,
                    "started_at": step.started_at.isoformat() if step.started_at else None,
                    "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                    "error": step.error,
                    "result": step.result
                }
                for step in workflow.steps
            ],
            "results": workflow.results,
            "summary": {
                "total_steps": len(workflow.steps),
                "completed_steps": len([s for s in workflow.steps if s.status == "completed"]),
                "failed_steps": len([s for s in workflow.steps if s.status == "failed"]),
                "success_rate": len([s for s in workflow.steps if s.status == "completed"]) / len(workflow.steps) * 100
            }
        }
    
    def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get current workflow status"""
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        workflow = self.active_workflows[workflow_id]
        return self._get_workflow_results(workflow)
    
    def list_workflows(self) -> List[Dict[str, Any]]:
        """List all workflows"""
        return [
            {
                "id": workflow.id,
                "name": workflow.name,
                "status": workflow.status.value,
                "created_at": workflow.created_at.isoformat(),
                "step_count": len(workflow.steps)
            }
            for workflow in self.active_workflows.values()
        ]
    
    def cancel_workflow(self, workflow_id: str) -> bool:
        """Cancel a running workflow"""
        if workflow_id not in self.active_workflows:
            return False
        
        workflow = self.active_workflows[workflow_id]
        if workflow.status == WorkflowStatus.RUNNING:
            workflow.status = WorkflowStatus.CANCELLED
            workflow.completed_at = datetime.utcnow()
            self.logger.info(f"Cancelled workflow: {workflow_id}")
            return True
        
        return False

# Global workflow engine instance
workflow_engine = WorkflowEngine()