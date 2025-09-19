"""
Main orchestrator interface for the complete agent system
"""

import asyncio
import json
import logging
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

from .base_agent import AgentExecutionContext, Task, TaskPriority
from .workflows.workflow_engine import workflow_engine, WorkflowEngine
from .workflows.predefined_workflows import get_workflow_template, list_workflow_templates
from .workflows.workflow_examples import WorkflowExamples
from .orchestrator.orchestrator_agent import OrchestratorAgent
from .planner.planner_agent import PlannerAgent
from .architecture.architecture_agent import ArchitectureAgent
from .backend.enhanced_backend_agent import BackendAgent
from .frontend.frontend_agent import FrontendAgent
from .validation.validation_agent import ValidationAgent

class MainOrchestrator:
    """
    Main orchestrator that provides a unified interface to the complete agent system
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.workflow_engine = workflow_engine
        self.agents = {}
        self._initialize_agents()
        
        # Track active projects and workflows
        self.active_projects: Dict[str, Dict] = {}
        self.workflow_history: List[Dict] = []
        
    def _initialize_agents(self):
        """Initialize all specialized agents"""
        self.agents = {
            "orchestrator": OrchestratorAgent(),
            "planner": PlannerAgent(), 
            "architecture": ArchitectureAgent(),
            "backend": BackendAgent(),
            "frontend": FrontendAgent(),
            "validator": ValidationAgent()
        }
        
        # Register agents with workflow engine
        for agent_type, agent in self.agents.items():
            self.workflow_engine.agents[agent_type] = agent
            
        self.logger.info(f"Initialized {len(self.agents)} specialized agents")
    
    async def create_project(self, project_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new project with complete development workflow
        
        Args:
            project_config: Project configuration including:
                - name: Project name
                - description: Project description  
                - type: Project type (full_stack_web_app, backend_api_only, etc.)
                - requirements: Detailed requirements
                - tech_stack: Preferred technology stack
                - team_info: Team skills and preferences
                - timeline: Project timeline constraints
                - quality_standards: Quality and validation requirements
        
        Returns:
            Project creation result with workflow ID and initial analysis
        """
        
        project_id = f"proj_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        self.logger.info(f"Creating new project: {project_id} - {project_config.get('name', 'Unnamed Project')}")
        
        # Create execution context
        context = AgentExecutionContext(
            project_id=project_id,
            user_id=project_config.get("user_id", "default_user"),
            requirements=project_config.get("requirements", {}),
            project_type=project_config.get("type", "full_stack_web_app"),
            tech_stack=project_config.get("tech_stack", []),
            configuration=project_config.get("configuration", {}),
            workspace_path=project_config.get("workspace_path", f"/tmp/projects/{project_id}")
        )
        
        # Ensure workspace directory exists
        os.makedirs(context.workspace_path, exist_ok=True)
        
        # Get appropriate workflow template
        workflow_template = get_workflow_template(context.project_type)
        
        # Customize workflow inputs
        workflow_inputs = self._prepare_workflow_inputs(project_config, context)
        
        # Update template with actual inputs
        customized_template = self._customize_workflow_template(workflow_template, workflow_inputs)
        
        # Create workflow
        workflow_id = self.workflow_engine.create_workflow(
            name=f"{project_config.get('name', 'Project')} - {workflow_template['name']}",
            description=f"Complete development workflow for {project_config.get('name', 'project')}",
            steps=customized_template["steps"],
            context=context
        )
        
        # Store project information
        project_info = {
            "project_id": project_id,
            "workflow_id": workflow_id,
            "name": project_config.get("name", "Unnamed Project"),
            "description": project_config.get("description", ""),
            "type": context.project_type,
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "context": context,
            "config": project_config
        }
        
        self.active_projects[project_id] = project_info
        
        # Run initial project analysis
        initial_analysis = await self._run_initial_analysis(project_config, context)
        
        return {
            "project_id": project_id,
            "workflow_id": workflow_id,
            "name": project_info["name"],
            "status": "ready_for_development",
            "initial_analysis": initial_analysis,
            "estimated_duration": initial_analysis.get("estimated_duration", "unknown"),
            "complexity_score": initial_analysis.get("complexity_score", 0),
            "recommended_team_size": initial_analysis.get("recommended_team_size", 2),
            "workspace_path": context.workspace_path,
            "next_steps": [
                "Review initial analysis and requirements",
                "Start development workflow execution",
                "Monitor progress and quality gates"
            ]
        }
    
    async def start_development(self, project_id: str) -> Dict[str, Any]:
        """
        Start the development workflow for a project
        
        Args:
            project_id: Project identifier
            
        Returns:
            Development execution results
        """
        
        if project_id not in self.active_projects:
            raise ValueError(f"Project not found: {project_id}")
        
        project_info = self.active_projects[project_id]
        workflow_id = project_info["workflow_id"]
        
        self.logger.info(f"Starting development workflow for project: {project_id}")
        
        # Update project status
        project_info["status"] = "in_development"
        project_info["development_started_at"] = datetime.utcnow().isoformat()
        
        try:
            # Execute the complete development workflow
            workflow_result = await self.workflow_engine.execute_workflow(workflow_id)
            
            # Update project status based on workflow result
            if workflow_result.get("status") == "completed":
                project_info["status"] = "development_completed"
                project_info["development_completed_at"] = datetime.utcnow().isoformat()
            else:
                project_info["status"] = "development_failed"
                project_info["development_failed_at"] = datetime.utcnow().isoformat()
            
            # Store workflow result
            project_info["workflow_result"] = workflow_result
            
            # Add to workflow history
            self.workflow_history.append({\n                \"project_id\": project_id,\n                \"workflow_id\": workflow_id,\n                \"result\": workflow_result,\n                \"completed_at\": datetime.utcnow().isoformat()\n            })\n            \n            return {\n                \"project_id\": project_id,\n                \"workflow_id\": workflow_id,\n                \"status\": workflow_result.get(\"status\"),\n                \"duration_seconds\": workflow_result.get(\"duration_seconds\"),\n                \"steps_completed\": workflow_result.get(\"summary\", {}).get(\"completed_steps\", 0),\n                \"files_generated\": self._count_generated_files(workflow_result),\n                \"quality_score\": self._calculate_overall_quality(workflow_result),\n                \"deliverables\": self._extract_deliverables(workflow_result),\n                \"recommendations\": self._extract_recommendations(workflow_result),\n                \"next_steps\": self._determine_next_steps(workflow_result)\n            }\n            \n        except Exception as e:\n            project_info[\"status\"] = \"development_error\"\n            project_info[\"error\"] = str(e)\n            project_info[\"error_at\"] = datetime.utcnow().isoformat()\n            \n            self.logger.error(f\"Development failed for project {project_id}: {e}\")\n            raise\n    \n    async def validate_project(self, project_id: str, validation_config: Optional[Dict] = None) -> Dict[str, Any]:\n        \"\"\"\n        Run comprehensive validation on a project\n        \n        Args:\n            project_id: Project identifier\n            validation_config: Optional validation configuration\n            \n        Returns:\n            Validation results\n        \"\"\"\n        \n        if project_id not in self.active_projects:\n            raise ValueError(f\"Project not found: {project_id}\")\n        \n        project_info = self.active_projects[project_id]\n        context = project_info[\"context\"]\n        \n        self.logger.info(f\"Running validation for project: {project_id}\")\n        \n        # Create validation task\n        validation_task = Task(\n            id=f\"validation_{project_id}\",\n            type=\"run_full_validation_suite\",\n            description=f\"Complete validation for project {project_id}\",\n            priority=TaskPriority.HIGH,\n            inputs={\n                \"project_path\": context.workspace_path,\n                \"validation_config\": validation_config or {},\n                \"quality_standards\": project_info[\"config\"].get(\"quality_standards\", {})\n            }\n        )\n        \n        # Execute validation\n        validator = self.agents[\"validator\"]\n        validation_result = await validator.start_task(validation_task, context)\n        \n        # Store validation result\n        project_info[\"last_validation\"] = {\n            \"result\": validation_result,\n            \"validated_at\": datetime.utcnow().isoformat()\n        }\n        \n        return validation_result\n    \n    async def get_project_status(self, project_id: str) -> Dict[str, Any]:\n        \"\"\"\n        Get comprehensive project status\n        \n        Args:\n            project_id: Project identifier\n            \n        Returns:\n            Detailed project status\n        \"\"\"\n        \n        if project_id not in self.active_projects:\n            raise ValueError(f\"Project not found: {project_id}\")\n        \n        project_info = self.active_projects[project_id]\n        \n        # Get workflow status if workflow exists\n        workflow_status = None\n        if \"workflow_id\" in project_info:\n            try:\n                workflow_status = self.workflow_engine.get_workflow_status(project_info[\"workflow_id\"])\n            except Exception as e:\n                self.logger.warning(f\"Could not get workflow status: {e}\")\n        \n        status = {\n            \"project_id\": project_id,\n            \"name\": project_info.get(\"name\"),\n            \"description\": project_info.get(\"description\"),\n            \"type\": project_info.get(\"type\"),\n            \"status\": project_info.get(\"status\"),\n            \"created_at\": project_info.get(\"created_at\"),\n            \"workspace_path\": project_info.get(\"context\").workspace_path,\n            \"workflow_status\": workflow_status,\n            \"last_validation\": project_info.get(\"last_validation\"),\n            \"files_in_workspace\": self._count_workspace_files(project_info.get(\"context\").workspace_path)\n        }\n        \n        # Add development timing if available\n        if \"development_started_at\" in project_info:\n            status[\"development_started_at\"] = project_info[\"development_started_at\"]\n        \n        if \"development_completed_at\" in project_info:\n            status[\"development_completed_at\"] = project_info[\"development_completed_at\"]\n            \n        if \"development_failed_at\" in project_info:\n            status[\"development_failed_at\"] = project_info[\"development_failed_at\"]\n            status[\"error\"] = project_info.get(\"error\")\n        \n        return status\n    \n    def list_projects(self) -> List[Dict[str, Any]]:\n        \"\"\"\n        List all projects\n        \n        Returns:\n            List of project summaries\n        \"\"\"\n        \n        projects = []\n        \n        for project_id, project_info in self.active_projects.items():\n            projects.append({\n                \"project_id\": project_id,\n                \"name\": project_info.get(\"name\"),\n                \"type\": project_info.get(\"type\"),\n                \"status\": project_info.get(\"status\"),\n                \"created_at\": project_info.get(\"created_at\")\n            })\n        \n        return sorted(projects, key=lambda x: x[\"created_at\"], reverse=True)\n    \n    def list_available_workflows(self) -> List[Dict[str, str]]:\n        \"\"\"\n        List available workflow templates\n        \n        Returns:\n            List of workflow templates\n        \"\"\"\n        \n        return list_workflow_templates()\n    \n    async def run_examples(self) -> Dict[str, Any]:\n        \"\"\"\n        Run all workflow examples for demonstration\n        \n        Returns:\n            Example execution results\n        \"\"\"\n        \n        self.logger.info(\"Running workflow examples\")\n        \n        examples_result = await WorkflowExamples.run_all_examples()\n        \n        return {\n            \"examples_run\": len(examples_result),\n            \"successful_examples\": len([r for r in examples_result.values() if r[\"status\"] == \"success\"]),\n            \"failed_examples\": len([r for r in examples_result.values() if r[\"status\"] == \"error\"]),\n            \"results\": examples_result,\n            \"executed_at\": datetime.utcnow().isoformat()\n        }\n    \n    # Helper methods\n    \n    def _prepare_workflow_inputs(self, project_config: Dict, context: AgentExecutionContext) -> Dict[str, Any]:\n        \"\"\"Prepare workflow inputs from project configuration\"\"\"\n        \n        return {\n            \"requirements\": project_config.get(\"requirements\", {}),\n            \"description\": project_config.get(\"description\", \"\"),\n            \"team_skills\": project_config.get(\"team_info\", {}).get(\"skills\", []),\n            \"design_system\": project_config.get(\"design_preferences\", {}),\n            \"entities\": project_config.get(\"data_entities\", []),\n            \"test_scenarios\": project_config.get(\"test_scenarios\", []),\n            \"demo_scenarios\": project_config.get(\"demo_scenarios\", []),\n            \"scalability_requirements\": project_config.get(\"scalability\", {}),\n            \"routing_requirements\": project_config.get(\"routing\", {}),\n            \"concept\": project_config.get(\"concept\", {}),\n            \"ui_requirements\": project_config.get(\"ui_requirements\", {}),\n            \"responsive_requirements\": project_config.get(\"responsive\", {}),\n            \"target_devices\": project_config.get(\"target_devices\", [\"desktop\", \"mobile\"]),\n            \"user_flows\": project_config.get(\"user_flows\", [])\n        }\n    \n    def _customize_workflow_template(self, template: Dict, inputs: Dict) -> Dict:\n        \"\"\"Customize workflow template with actual inputs\"\"\"\n        \n        customized_template = json.loads(json.dumps(template))  # Deep copy\n        \n        for step in customized_template[\"steps\"]:\n            for key, value in step[\"inputs\"].items():\n                if isinstance(value, str) and value.startswith(\"${workflow.\"):\n                    workflow_key = value[2:-1].split(\".\")[-1]\n                    if workflow_key in inputs:\n                        step[\"inputs\"][key] = inputs[workflow_key]\n        \n        return customized_template\n    \n    async def _run_initial_analysis(self, project_config: Dict, context: AgentExecutionContext) -> Dict[str, Any]:\n        \"\"\"Run initial project analysis\"\"\"\n        \n        # Create analysis task\n        analysis_task = Task(\n            id=\"initial_analysis\",\n            type=\"analyze_requirements\",\n            description=\"Initial project analysis\",\n            priority=TaskPriority.HIGH,\n            inputs={\n                \"requirements\": project_config.get(\"requirements\", {}),\n                \"description\": project_config.get(\"description\", \"\")\n            }\n        )\n        \n        # Execute analysis\n        planner = self.agents[\"planner\"]\n        analysis_result = await planner.start_task(analysis_task, context)\n        \n        return analysis_result\n    \n    def _count_generated_files(self, workflow_result: Dict) -> int:\n        \"\"\"Count total files generated in workflow\"\"\"\n        total_files = 0\n        \n        for step_result in workflow_result.get(\"steps\", []):\n            if step_result.get(\"result\"):\n                result = step_result[\"result\"]\n                if \"created_files\" in result:\n                    total_files += len(result[\"created_files\"])\n                elif \"files_generated\" in result:\n                    total_files += result[\"files_generated\"]\n        \n        return total_files\n    \n    def _calculate_overall_quality(self, workflow_result: Dict) -> float:\n        \"\"\"Calculate overall project quality score\"\"\"\n        quality_scores = []\n        \n        for step_result in workflow_result.get(\"steps\", []):\n            if step_result.get(\"result\"):\n                result = step_result[\"result\"]\n                if \"quality_score\" in result:\n                    quality_scores.append(result[\"quality_score\"])\n        \n        return sum(quality_scores) / len(quality_scores) if quality_scores else 0\n    \n    def _extract_deliverables(self, workflow_result: Dict) -> List[str]:\n        \"\"\"Extract key deliverables from workflow result\"\"\"\n        deliverables = []\n        \n        for step_result in workflow_result.get(\"steps\", []):\n            step_name = step_result.get(\"name\", \"\")\n            if step_result.get(\"status\") == \"completed\":\n                deliverables.append(f\"✅ {step_name}\")\n            else:\n                deliverables.append(f\"❌ {step_name}\")\n        \n        return deliverables\n    \n    def _extract_recommendations(self, workflow_result: Dict) -> List[str]:\n        \"\"\"Extract recommendations from workflow result\"\"\"\n        recommendations = []\n        \n        for step_result in workflow_result.get(\"steps\", []):\n            if step_result.get(\"result\"):\n                result = step_result[\"result\"]\n                if \"recommendations\" in result:\n                    recommendations.extend(result[\"recommendations\"])\n        \n        # Remove duplicates while preserving order\n        seen = set()\n        unique_recommendations = []\n        for rec in recommendations:\n            if rec not in seen:\n                seen.add(rec)\n                unique_recommendations.append(rec)\n        \n        return unique_recommendations[:10]  # Return top 10\n    \n    def _determine_next_steps(self, workflow_result: Dict) -> List[str]:\n        \"\"\"Determine next steps based on workflow result\"\"\"\n        \n        if workflow_result.get(\"status\") == \"completed\":\n            return [\n                \"Run comprehensive validation suite\",\n                \"Deploy to staging environment\",\n                \"Conduct user acceptance testing\",\n                \"Prepare for production deployment\"\n            ]\n        else:\n            return [\n                \"Review workflow failures\",\n                \"Address identified issues\",\n                \"Re-run failed workflow steps\",\n                \"Consult development team for resolution\"\n            ]\n    \n    def _count_workspace_files(self, workspace_path: str) -> int:\n        \"\"\"Count files in workspace\"\"\"\n        if not os.path.exists(workspace_path):\n            return 0\n        \n        file_count = 0\n        for root, dirs, files in os.walk(workspace_path):\n            file_count += len(files)\n        \n        return file_count\n\n# Global orchestrator instance\nmain_orchestrator = MainOrchestrator()