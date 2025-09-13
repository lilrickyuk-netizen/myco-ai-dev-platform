import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
from ..llm_adapter import LLMMessage, llm_manager

class PlannerAgent(BaseAgent):
    """Agent responsible for project planning and task decomposition"""
    
    def __init__(self):
        super().__init__("planner-001", AgentType.PLANNER)
        self.capabilities = [
            "requirements_analysis",
            "project_planning", 
            "task_decomposition",
            "effort_estimation",
            "timeline_creation",
            "resource_planning",
            "risk_assessment",
            "milestone_definition"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        """Check if this agent can handle the given task"""
        planning_tasks = [
            "analyze_requirements",
            "create_project_plan",
            "decompose_tasks",
            "estimate_effort",
            "create_timeline",
            "assess_risks",
            "define_milestones",
            "plan_resources"
        ]
        return task.type in planning_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute planning tasks"""
        
        if task.type == "analyze_requirements":
            return await self._analyze_requirements(task, context)
        elif task.type == "create_project_plan":
            return await self._create_project_plan(task, context)
        elif task.type == "decompose_tasks":
            return await self._decompose_tasks(task, context)
        elif task.type == "estimate_effort":
            return await self._estimate_effort(task, context)
        elif task.type == "create_timeline":
            return await self._create_timeline(task, context)
        elif task.type == "assess_risks":
            return await self._assess_risks(task, context)
        elif task.type == "define_milestones":
            return await self._define_milestones(task, context)
        elif task.type == "plan_resources":
            return await self._plan_resources(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _analyze_requirements(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Analyze and structure project requirements"""
        
        requirements = task.inputs.get("requirements", {})
        project_description = task.inputs.get("description", "")
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior business analyst and project planner. Analyze the given project requirements and provide a comprehensive requirements analysis.

Generate a structured analysis including:
1. Functional requirements (what the system should do)
2. Non-functional requirements (performance, security, usability)
3. Technical requirements (technology stack, infrastructure)
4. Business requirements (goals, constraints, success criteria)
5. User requirements (user types, user stories, personas)
6. Integration requirements (external systems, APIs)
7. Compliance requirements (regulations, standards)
8. Data requirements (data models, storage, privacy)

Format as JSON:
{
    "functional_requirements": [
        {
            "id": "FR001",
            "title": "requirement title",
            "description": "detailed description",
            "priority": "high|medium|low",
            "acceptance_criteria": ["criteria 1", "criteria 2"]
        }
    ],
    "non_functional_requirements": [
        {
            "category": "performance",
            "requirements": [
                {
                    "id": "NFR001", 
                    "description": "requirement description",
                    "target": "specific target value"
                }
            ]
        }
    ],
    "user_stories": [
        {
            "id": "US001",
            "persona": "user type",
            "story": "As a [persona], I want [goal] so that [benefit]",
            "priority": "high|medium|low",
            "acceptance_criteria": ["criteria 1"]
        }
    ],
    "technical_requirements": {
        "platforms": ["web", "mobile"],
        "browsers": ["Chrome", "Firefox", "Safari"],
        "performance": {
            "response_time": "< 2s",
            "concurrent_users": "1000+"
        }
    },
    "constraints": [
        {
            "type": "technical|business|regulatory",
            "description": "constraint description",
            "impact": "impact on project"
        }
    ],
    "assumptions": ["assumption 1", "assumption 2"],
    "dependencies": ["external dependency 1"]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Analyze requirements for project:\n\nDescription: {project_description}\n\nRequirements: {json.dumps(requirements, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            analysis = json.loads(response.content)
            
            return {
                "requirements_analysis": analysis,
                "original_requirements": requirements,
                "analysis_metadata": {
                    "analyzed_at": datetime.utcnow().isoformat(),
                    "complexity_score": self._calculate_complexity_score(analysis),
                    "estimated_duration": self._estimate_project_duration(analysis),
                    "risk_level": self._assess_initial_risk(analysis)
                }
            }
        except Exception as e:
            self.logger.error(f"Requirements analysis failed: {e}")
            raise
    
    async def _create_project_plan(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create comprehensive project plan"""
        
        requirements_analysis = task.inputs.get("requirements_analysis", {})
        tech_stack = context.tech_stack
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior project manager creating a comprehensive project plan. Based on the requirements analysis and technology stack, create a detailed project plan.

Generate:
1. Project phases and deliverables
2. Work breakdown structure (WBS)
3. Task dependencies and sequencing
4. Resource allocation
5. Timeline and milestones
6. Risk mitigation strategies
7. Quality assurance plan
8. Communication plan

Format as JSON:
{
    "project_overview": {
        "name": "project name",
        "description": "project description",
        "objectives": ["objective 1", "objective 2"],
        "success_criteria": ["criteria 1", "criteria 2"],
        "estimated_duration": "X weeks/months",
        "estimated_effort": "X person-months"
    },
    "phases": [
        {
            "id": "phase1",
            "name": "Analysis & Design",
            "description": "phase description",
            "duration": "2 weeks",
            "deliverables": ["deliverable 1", "deliverable 2"],
            "tasks": [
                {
                    "id": "task1",
                    "name": "task name",
                    "description": "task description",
                    "effort": "X hours",
                    "dependencies": ["task_id"],
                    "skills_required": ["skill1", "skill2"],
                    "deliverables": ["deliverable"]
                }
            ]
        }
    ],
    "milestones": [
        {
            "id": "milestone1",
            "name": "milestone name",
            "description": "description",
            "target_date": "YYYY-MM-DD",
            "criteria": ["completion criteria"]
        }
    ],
    "resources": [
        {
            "role": "Backend Developer",
            "count": 2,
            "skills": ["Node.js", "TypeScript"],
            "allocation": "100%"
        }
    ],
    "risks": [
        {
            "id": "risk1",
            "description": "risk description",
            "probability": "high|medium|low",
            "impact": "high|medium|low",
            "mitigation": "mitigation strategy"
        }
    ],
    "quality_plan": {
        "code_review": "process description",
        "testing_strategy": "testing approach",
        "quality_gates": ["gate 1", "gate 2"]
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Create project plan based on:\n\nRequirements Analysis: {json.dumps(requirements_analysis, indent=2)}\n\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            plan = json.loads(response.content)
            
            return {
                "project_plan": plan,
                "plan_metadata": {
                    "created_at": datetime.utcnow().isoformat(),
                    "planner_agent": self.agent_id,
                    "plan_version": "1.0",
                    "next_review_date": (datetime.utcnow() + timedelta(weeks=2)).isoformat()
                }
            }
        except Exception as e:
            self.logger.error(f"Project planning failed: {e}")
            raise
    
    async def _decompose_tasks(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Decompose high-level tasks into actionable work items"""
        
        high_level_tasks = task.inputs.get("tasks", [])
        project_context = task.inputs.get("project_context", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an expert at task decomposition and work breakdown. Break down high-level tasks into specific, actionable work items.

For each high-level task, create:
1. Detailed sub-tasks with clear deliverables
2. Acceptance criteria for each sub-task
3. Effort estimates (in hours)
4. Skill requirements
5. Dependencies between tasks
6. Definition of done

Format as JSON:
{
    "task_breakdown": [
        {
            "parent_task": "high level task name",
            "subtasks": [
                {
                    "id": "subtask_id",
                    "name": "subtask name",
                    "description": "detailed description",
                    "acceptance_criteria": ["criteria 1", "criteria 2"],
                    "effort_hours": 8,
                    "skills_required": ["JavaScript", "React"],
                    "dependencies": ["other_subtask_id"],
                    "deliverables": ["deliverable 1"],
                    "definition_of_done": "completion criteria",
                    "priority": "high|medium|low"
                }
            ]
        }
    ],
    "summary": {
        "total_tasks": 25,
        "total_effort_hours": 320,
        "complexity_distribution": {
            "simple": 15,
            "medium": 8,
            "complex": 2
        }
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Decompose these high-level tasks:\n\nTasks: {json.dumps(high_level_tasks, indent=2)}\n\nProject Context: {json.dumps(project_context, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            breakdown = json.loads(response.content)
            
            return {
                "task_breakdown": breakdown,
                "decomposition_metadata": {
                    "decomposed_at": datetime.utcnow().isoformat(),
                    "original_tasks_count": len(high_level_tasks),
                    "generated_subtasks_count": breakdown.get("summary", {}).get("total_tasks", 0)
                }
            }
        except Exception as e:
            self.logger.error(f"Task decomposition failed: {e}")
            raise
    
    async def _estimate_effort(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Estimate effort for project tasks"""
        
        tasks = task.inputs.get("tasks", [])
        team_velocity = task.inputs.get("team_velocity", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an expert at software development effort estimation. Provide detailed effort estimates for the given tasks.

Consider:
1. Task complexity
2. Technology requirements
3. Team experience
4. Integration complexity
5. Testing requirements
6. Documentation needs
7. Risk factors

Use multiple estimation techniques:
- Bottom-up estimation
- Analogous estimation
- Parametric estimation
- Three-point estimation (optimistic, pessimistic, most likely)

Format as JSON:
{
    "effort_estimates": [
        {
            "task_id": "task_id",
            "task_name": "task name",
            "estimates": {
                "optimistic_hours": 4,
                "most_likely_hours": 8,
                "pessimistic_hours": 16,
                "expected_hours": 8.7,
                "confidence_level": "medium"
            },
            "complexity_factors": [
                {
                    "factor": "Technology familiarity",
                    "impact": "medium",
                    "multiplier": 1.2
                }
            ],
            "assumptions": ["assumption 1", "assumption 2"],
            "risks": ["risk 1", "risk 2"]
        }
    ],
    "project_totals": {
        "total_optimistic_hours": 120,
        "total_expected_hours": 180,
        "total_pessimistic_hours": 240,
        "recommended_buffer": "20%",
        "confidence_level": "medium"
    },
    "recommendations": [
        "recommendation 1",
        "recommendation 2"
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Estimate effort for tasks:\n\nTasks: {json.dumps(tasks, indent=2)}\n\nTeam Velocity: {json.dumps(team_velocity, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            estimates = json.loads(response.content)
            
            return {
                "effort_estimates": estimates,
                "estimation_metadata": {
                    "estimated_at": datetime.utcnow().isoformat(),
                    "estimation_method": "three_point_with_factors",
                    "estimator": self.agent_id
                }
            }
        except Exception as e:
            self.logger.error(f"Effort estimation failed: {e}")
            raise
    
    async def _create_timeline(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create project timeline with milestones"""
        
        effort_estimates = task.inputs.get("effort_estimates", {})
        team_capacity = task.inputs.get("team_capacity", {})
        constraints = task.inputs.get("constraints", [])
        
        # Calculate timeline based on effort and capacity
        timeline = self._calculate_timeline(effort_estimates, team_capacity, constraints)
        
        return {
            "timeline": timeline,
            "timeline_metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "method": "critical_path_method",
                "confidence": "medium"
            }
        }
    
    async def _assess_risks(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Assess project risks and create mitigation strategies"""
        
        project_details = task.inputs.get("project_details", {})
        tech_stack = context.tech_stack
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a risk management expert. Identify and assess potential project risks and create mitigation strategies.

Analyze risks in these categories:
1. Technical risks (technology, complexity, integration)
2. Resource risks (availability, skills, turnover)
3. Schedule risks (dependencies, scope creep)
4. Business risks (changing requirements, market)
5. External risks (vendors, regulations)

Format as JSON with detailed risk register."""
            ),
            LLMMessage(
                role="user",
                content=f"Assess risks for project:\n\nProject: {json.dumps(project_details, indent=2)}\n\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            risk_assessment = json.loads(response.content)
            
            return {
                "risk_assessment": risk_assessment,
                "assessment_metadata": {
                    "assessed_at": datetime.utcnow().isoformat(),
                    "assessor": self.agent_id
                }
            }
        except Exception as e:
            self.logger.error(f"Risk assessment failed: {e}")
            raise
    
    async def _define_milestones(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Define project milestones and success criteria"""
        
        project_plan = task.inputs.get("project_plan", {})
        
        # Extract key deliverables and create milestone schedule
        milestones = self._extract_milestones(project_plan)
        
        return {
            "milestones": milestones,
            "milestone_metadata": {
                "defined_at": datetime.utcnow().isoformat(),
                "review_frequency": "weekly"
            }
        }
    
    async def _plan_resources(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Plan resource allocation and team structure"""
        
        effort_estimates = task.inputs.get("effort_estimates", {})
        available_team = task.inputs.get("available_team", {})
        
        # Create resource allocation plan
        resource_plan = self._create_resource_plan(effort_estimates, available_team)
        
        return {
            "resource_plan": resource_plan,
            "resource_metadata": {
                "planned_at": datetime.utcnow().isoformat(),
                "allocation_method": "skill_based"
            }
        }
    
    def _calculate_complexity_score(self, analysis: Dict[str, Any]) -> int:
        """Calculate project complexity score based on requirements"""
        score = 0
        
        # Functional requirements complexity
        func_reqs = analysis.get("functional_requirements", [])
        score += len(func_reqs) * 2
        
        # Non-functional requirements complexity
        nf_reqs = analysis.get("non_functional_requirements", [])
        score += len(nf_reqs) * 3
        
        # Integration complexity
        integrations = analysis.get("dependencies", [])
        score += len(integrations) * 5
        
        return min(score, 100)  # Cap at 100
    
    def _estimate_project_duration(self, analysis: Dict[str, Any]) -> str:
        """Estimate rough project duration based on complexity"""
        complexity = self._calculate_complexity_score(analysis)
        
        if complexity < 20:
            return "2-4 weeks"
        elif complexity < 40:
            return "1-2 months"
        elif complexity < 60:
            return "2-4 months"
        elif complexity < 80:
            return "4-6 months"
        else:
            return "6+ months"
    
    def _assess_initial_risk(self, analysis: Dict[str, Any]) -> str:
        """Assess initial risk level based on requirements"""
        risk_factors = 0
        
        # Count risk indicators
        constraints = analysis.get("constraints", [])
        risk_factors += len(constraints)
        
        dependencies = analysis.get("dependencies", [])
        risk_factors += len(dependencies) * 2
        
        if risk_factors < 3:
            return "low"
        elif risk_factors < 6:
            return "medium"
        else:
            return "high"
    
    def _calculate_timeline(self, effort_estimates: Dict, team_capacity: Dict, constraints: List) -> Dict:
        """Calculate project timeline"""
        # Simplified timeline calculation
        total_hours = effort_estimates.get("project_totals", {}).get("total_expected_hours", 160)
        team_size = team_capacity.get("developers", 2)
        hours_per_week = team_capacity.get("hours_per_week", 40)
        
        weeks_needed = total_hours / (team_size * hours_per_week)
        
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(weeks=weeks_needed)
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "duration_weeks": round(weeks_needed, 1),
            "critical_path": [],
            "buffer_weeks": round(weeks_needed * 0.2, 1)
        }
    
    def _extract_milestones(self, project_plan: Dict) -> List[Dict]:
        """Extract key milestones from project plan"""
        milestones = []
        
        phases = project_plan.get("phases", [])
        for i, phase in enumerate(phases):
            milestone = {
                "id": f"milestone_{i+1}",
                "name": f"{phase.get('name', 'Phase')} Completion",
                "description": f"Completion of {phase.get('name', 'phase')}",
                "target_week": i * 2 + 2,  # Rough estimate
                "deliverables": phase.get("deliverables", []),
                "success_criteria": ["All phase deliverables completed", "Quality gates passed"]
            }
            milestones.append(milestone)
        
        return milestones
    
    def _create_resource_plan(self, effort_estimates: Dict, available_team: Dict) -> Dict:
        """Create resource allocation plan"""
        return {
            "team_structure": {
                "project_manager": 1,
                "tech_lead": 1,
                "developers": 2,
                "qa_engineer": 1,
                "devops_engineer": 0.5
            },
            "skill_requirements": [
                "JavaScript/TypeScript",
                "React/Vue.js",
                "Node.js",
                "Database design",
                "Cloud platforms"
            ],
            "allocation_strategy": "skill_based_assignment",
            "capacity_planning": {
                "peak_team_size": 4,
                "average_team_size": 3,
                "utilization_target": "80%"
            }
        }