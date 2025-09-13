import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext, AgentStatus
from ..llm_adapter import LLMMessage, llm_manager
from ..config import config

class PlannerAgent(BaseAgent):
    def __init__(self):
        super().__init__("planner-001", AgentType.PLANNER)
        self.capabilities = [
            "requirements_analysis",
            "technical_planning",
            "task_decomposition",
            "dependency_mapping",
            "timeline_estimation",
            "resource_planning"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        return task.type in [
            "analyze_requirements",
            "plan_project_structure", 
            "validate_tech_stack",
            "create_development_plan",
            "estimate_effort",
            "analyze_dependencies"
        ]
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute planning tasks"""
        self.logger.info(f"Executing planning task: {task.type}")
        
        if task.type == "analyze_requirements":
            return await self._analyze_requirements(task, context)
        elif task.type == "plan_project_structure":
            return await self._plan_project_structure(task, context)
        elif task.type == "validate_tech_stack":
            return await self._validate_tech_stack(task, context)
        elif task.type == "create_development_plan":
            return await self._create_development_plan(task, context)
        elif task.type == "estimate_effort":
            return await self._estimate_effort(task, context)
        elif task.type == "analyze_dependencies":
            return await self._analyze_dependencies(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _analyze_requirements(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Analyze and validate project requirements"""
        requirements = task.inputs.get("requirements", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an expert software requirements analyst. Your job is to analyze project requirements and provide detailed insights, validations, and recommendations.

Analyze the given requirements and provide:
1. Requirements validation (completeness, clarity, feasibility)
2. Functional requirements breakdown
3. Non-functional requirements identification
4. Missing requirements identification
5. Risk assessment
6. Success criteria validation
7. Acceptance criteria suggestions

Format your response as JSON with the following structure:
{
    "validation": {
        "completeness_score": 0-100,
        "clarity_score": 0-100,
        "feasibility_score": 0-100,
        "issues": ["list of issues"],
        "recommendations": ["list of recommendations"]
    },
    "functional_requirements": {
        "core_features": ["list"],
        "advanced_features": ["list"],
        "integrations": ["list"]
    },
    "non_functional_requirements": {
        "performance": {},
        "security": {},
        "scalability": {},
        "availability": {},
        "usability": {}
    },
    "missing_requirements": ["list"],
    "risks": [
        {
            "risk": "description",
            "probability": "high/medium/low",
            "impact": "high/medium/low",
            "mitigation": "strategy"
        }
    ],
    "success_criteria": ["refined criteria"],
    "acceptance_criteria": {
        "feature_name": ["criteria"]
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Analyze these project requirements:\n\n{json.dumps(requirements, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            analysis = json.loads(response.content)
            
            return {
                "requirements_analysis": analysis,
                "original_requirements": requirements,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "confidence_score": 0.9,
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Requirements analysis failed: {e}")
            raise
    
    async def _plan_project_structure(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Plan project directory structure and organization"""
        project_type = task.inputs.get("project_type")
        tech_stack = task.inputs.get("tech_stack", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an expert software architect specializing in project structure and organization. 

Create a comprehensive project structure plan based on the project type and technology stack. Include:
1. Directory structure with explanations
2. File organization patterns
3. Module/package structure
4. Configuration file locations
5. Build and deployment structure
6. Testing structure
7. Documentation structure
8. Best practices recommendations

Format as JSON:
{
    "directory_structure": {
        "path": {
            "description": "purpose",
            "files": ["expected files"],
            "subdirectories": {}
        }
    },
    "organization_patterns": {
        "frontend": "pattern description",
        "backend": "pattern description",
        "shared": "pattern description"
    },
    "conventions": {
        "naming": "conventions",
        "imports": "conventions",
        "exports": "conventions"
    },
    "build_structure": {},
    "testing_structure": {},
    "recommendations": ["best practices"]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Plan project structure for:\nProject Type: {project_type}\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            structure_plan = json.loads(response.content)
            
            return {
                "project_structure": structure_plan,
                "project_type": project_type,
                "tech_stack": tech_stack,
                "plan_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Project structure planning failed: {e}")
            raise
    
    async def _validate_tech_stack(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Validate and optimize technology stack"""
        tech_stack = task.inputs.get("tech_stack", [])
        project_type = task.inputs.get("project_type")
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior technology consultant. Validate the proposed technology stack and provide optimization recommendations.

Analyze:
1. Technology compatibility
2. Version compatibility
3. Performance implications
4. Security considerations
5. Maintenance overhead
6. Learning curve
7. Community support
8. Alternative suggestions

Format as JSON:
{
    "validation": {
        "compatibility_score": 0-100,
        "performance_score": 0-100,
        "security_score": 0-100,
        "maintainability_score": 0-100,
        "overall_score": 0-100
    },
    "issues": [
        {
            "component": "technology name",
            "issue": "description",
            "severity": "high/medium/low",
            "recommendation": "solution"
        }
    ],
    "optimizations": [
        {
            "current": "technology",
            "suggested": "alternative",
            "reason": "justification",
            "effort": "low/medium/high"
        }
    ],
    "dependencies": {
        "required": ["list"],
        "optional": ["list"],
        "development": ["list"]
    },
    "version_recommendations": {
        "technology": "version"
    },
    "architecture_implications": ["implications"]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Validate tech stack for {project_type}:\n{json.dumps(tech_stack, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            validation = json.loads(response.content)
            
            return {
                "tech_stack_validation": validation,
                "original_stack": tech_stack,
                "project_type": project_type,
                "validation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Tech stack validation failed: {e}")
            raise
    
    async def _create_development_plan(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create comprehensive development plan"""
        requirements = task.inputs.get("requirements", {})
        tech_stack = task.inputs.get("tech_stack", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior project manager and technical lead. Create a comprehensive development plan.

Include:
1. Development phases with milestones
2. Task breakdown structure
3. Parallel development opportunities
4. Critical path analysis
5. Resource requirements
6. Risk mitigation plans
7. Quality gates
8. Testing strategy
9. Deployment strategy

Format as JSON:
{
    "phases": [
        {
            "name": "phase name",
            "description": "description",
            "duration_estimate": "time",
            "milestones": ["milestones"],
            "deliverables": ["deliverables"],
            "dependencies": ["dependencies"],
            "risks": ["risks"]
        }
    ],
    "task_breakdown": {
        "category": [
            {
                "task": "task name",
                "description": "description",
                "effort": "hours",
                "priority": "high/medium/low",
                "dependencies": ["tasks"],
                "skills_required": ["skills"]
            }
        ]
    },
    "parallel_tracks": [
        {
            "track_name": "name",
            "tasks": ["tasks that can run in parallel"]
        }
    ],
    "critical_path": ["tasks on critical path"],
    "quality_gates": [
        {
            "gate": "name",
            "criteria": ["criteria"],
            "phase": "phase"
        }
    ],
    "resource_plan": {
        "roles_needed": ["roles"],
        "peak_resources": "count",
        "duration": "timeline"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Create development plan for:\nRequirements: {json.dumps(requirements, indent=2)}\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            dev_plan = json.loads(response.content)
            
            return {
                "development_plan": dev_plan,
                "requirements": requirements,
                "tech_stack": tech_stack,
                "plan_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Development planning failed: {e}")
            raise
    
    async def _estimate_effort(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Estimate development effort and timeline"""
        features = task.inputs.get("features", [])
        complexity = task.inputs.get("complexity", "medium")
        team_size = task.inputs.get("team_size", 1)
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an expert software estimation specialist. Provide detailed effort estimates.

Consider:
1. Feature complexity
2. Technical challenges
3. Integration requirements
4. Testing overhead
5. Documentation needs
6. Deployment complexity
7. Team experience
8. Risk factors

Provide estimates in story points and hours with confidence intervals.

Format as JSON:
{
    "overall_estimate": {
        "story_points": "range",
        "hours": "range",
        "weeks": "range",
        "confidence": "percentage"
    },
    "feature_estimates": [
        {
            "feature": "name",
            "story_points": "points",
            "hours": "hours",
            "complexity": "high/medium/low",
            "risk_factors": ["factors"],
            "dependencies": ["features"]
        }
    ],
    "breakdown": {
        "development": "percentage",
        "testing": "percentage", 
        "integration": "percentage",
        "documentation": "percentage",
        "deployment": "percentage",
        "buffer": "percentage"
    },
    "assumptions": ["list of assumptions"],
    "risks": ["estimation risks"],
    "recommendations": ["recommendations"]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Estimate effort for features: {features}\nComplexity: {complexity}\nTeam size: {team_size}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            estimates = json.loads(response.content)
            
            return {
                "effort_estimation": estimates,
                "features": features,
                "complexity": complexity,
                "team_size": team_size,
                "estimation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Effort estimation failed: {e}")
            raise
    
    async def _analyze_dependencies(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Analyze project dependencies and constraints"""
        components = task.inputs.get("components", [])
        external_services = task.inputs.get("external_services", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a systems analyst specializing in dependency analysis. Analyze dependencies and constraints.

Identify:
1. Internal dependencies between components
2. External service dependencies
3. Data dependencies
4. Infrastructure dependencies
5. Third-party library dependencies
6. Circular dependencies
7. Critical path dependencies
8. Optional vs required dependencies

Format as JSON:
{
    "dependency_graph": {
        "component": {
            "depends_on": ["components"],
            "required_by": ["components"],
            "type": "hard/soft"
        }
    },
    "external_dependencies": [
        {
            "service": "name",
            "type": "API/database/storage/etc",
            "criticality": "critical/important/optional",
            "alternatives": ["alternatives"],
            "risk_level": "high/medium/low"
        }
    ],
    "constraints": [
        {
            "constraint": "description",
            "impact": "description",
            "workaround": "solution"
        }
    ],
    "critical_path": ["components on critical path"],
    "bottlenecks": ["potential bottlenecks"],
    "recommendations": ["optimization suggestions"]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Analyze dependencies for:\nComponents: {components}\nExternal Services: {external_services}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            dependency_analysis = json.loads(response.content)
            
            return {
                "dependency_analysis": dependency_analysis,
                "components": components,
                "external_services": external_services,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Dependency analysis failed: {e}")
            raise