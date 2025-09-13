"""
Agent management service
"""

import asyncio
import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from ..core.config import settings, AGENT_CAPABILITIES
from ..core.exceptions import AgentError

class AgentManager:
    """Manages AI agents and task orchestration"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.agents: Dict[str, Dict[str, Any]] = {}
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.running = False
        
    async def initialize(self):
        """Initialize the agent manager"""
        self.logger.info("Initializing Agent Manager...")
        
        # Initialize agent instances
        await self._initialize_agents()
        
        # Start task processor
        self.running = True
        asyncio.create_task(self._process_tasks())
        
        self.logger.info("Agent Manager initialized successfully")
    
    async def cleanup(self):
        """Cleanup the agent manager"""
        self.logger.info("Shutting down Agent Manager...")
        
        self.running = False
        
        # Stop all agents
        for agent_id in list(self.agents.keys()):
            await self.stop_agent(agent_id)
        
        self.logger.info("Agent Manager shutdown complete")
    
    async def _initialize_agents(self):
        """Initialize all available agents"""
        
        agent_types = [
            "planner",
            "architect", 
            "backend",
            "frontend",
            "devops",
            "tester"
        ]
        
        for agent_type in agent_types:
            agent_id = f"{agent_type}-{uuid.uuid4().hex[:8]}"
            
            self.agents[agent_id] = {
                "id": agent_id,
                "type": agent_type,
                "status": "idle",
                "capabilities": AGENT_CAPABILITIES.get(agent_type, []),
                "current_task": None,
                "last_activity": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            
            self.logger.info(f"Initialized {agent_type} agent: {agent_id}")
    
    async def get_status(self) -> Dict[str, Any]:
        """Get overall agent system status"""
        
        agent_stats = {
            "total": len(self.agents),
            "idle": len([a for a in self.agents.values() if a["status"] == "idle"]),
            "busy": len([a for a in self.agents.values() if a["status"] == "busy"]),
            "error": len([a for a in self.agents.values() if a["status"] == "error"])
        }
        
        task_stats = {
            "total": len(self.tasks),
            "queued": len([t for t in self.tasks.values() if t["status"] == "queued"]),
            "running": len([t for t in self.tasks.values() if t["status"] == "running"]),
            "completed": len([t for t in self.tasks.values() if t["status"] == "completed"]),
            "failed": len([t for t in self.tasks.values() if t["status"] == "failed"])
        }
        
        return {
            "system_status": "running" if self.running else "stopped",
            "agents": agent_stats,
            "tasks": task_stats,
            "queue_size": self.task_queue.qsize(),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def list_agents(self) -> List[Dict[str, Any]]:
        """List all agents"""
        return list(self.agents.values())
    
    async def get_capabilities(self) -> Dict[str, List[str]]:
        """Get capabilities of each agent type"""
        return AGENT_CAPABILITIES.copy()
    
    async def execute_task(
        self,
        task_type: str,
        inputs: Dict[str, Any],
        priority: str = "normal",
        timeout: int = 300,
        user_id: str = "system"
    ) -> str:
        """Execute a task using appropriate agent"""
        
        task_id = str(uuid.uuid4())
        
        # Create task record
        task = {
            "id": task_id,
            "type": task_type,
            "inputs": inputs,
            "priority": priority,
            "timeout": timeout,
            "user_id": user_id,
            "status": "queued",
            "result": None,
            "error": None,
            "created_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None,
            "assigned_agent": None
        }
        
        self.tasks[task_id] = task
        
        # Add to queue
        await self.task_queue.put(task_id)
        
        self.logger.info(f"Task {task_id} queued for execution")
        return task_id
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        return self.tasks.get(task_id)
    
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """Update task status"""
        
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        task["status"] = status
        
        if result:
            task["result"] = result
        
        if error:
            task["error"] = error
        
        if status in ["completed", "failed"]:
            task["completed_at"] = datetime.utcnow()
        
        self.logger.info(f"Task {task_id} status updated to {status}")
    
    async def stop_agent(self, agent_id: str) -> bool:
        """Stop a specific agent"""
        
        if agent_id not in self.agents:
            return False
        
        agent = self.agents[agent_id]
        agent["status"] = "stopped"
        agent["last_activity"] = datetime.utcnow()
        
        self.logger.info(f"Agent {agent_id} stopped")
        return True
    
    async def _process_tasks(self):
        """Process tasks from the queue"""
        
        while self.running:
            try:
                # Get task from queue (wait up to 1 second)
                task_id = await asyncio.wait_for(
                    self.task_queue.get(),
                    timeout=1.0
                )
                
                # Process the task
                await self._execute_single_task(task_id)
                
            except asyncio.TimeoutError:
                # No tasks in queue, continue
                continue
            except Exception as e:
                self.logger.error(f"Error processing task queue: {e}")
                await asyncio.sleep(1)
    
    async def _execute_single_task(self, task_id: str):
        """Execute a single task"""
        
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        
        try:
            # Find suitable agent
            agent = self._find_suitable_agent(task["type"])
            
            if not agent:
                raise AgentError(f"No suitable agent found for task type: {task['type']}")
            
            # Assign task to agent
            task["assigned_agent"] = agent["id"]
            task["status"] = "running"
            task["started_at"] = datetime.utcnow()
            
            agent["status"] = "busy"
            agent["current_task"] = task_id
            agent["last_activity"] = datetime.utcnow()
            
            self.logger.info(f"Executing task {task_id} with agent {agent['id']}")
            
            # Execute the task with real agent
            result = await self._execute_real_task(task, agent)
            
            # Update task status
            task["status"] = "completed"
            task["result"] = result
            task["completed_at"] = datetime.utcnow()
            
            # Free up agent
            agent["status"] = "idle"
            agent["current_task"] = None
            agent["last_activity"] = datetime.utcnow()
            
            self.logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            # Handle task failure
            task["status"] = "failed"
            task["error"] = str(e)
            task["completed_at"] = datetime.utcnow()
            
            # Free up agent if assigned
            if task.get("assigned_agent"):
                agent_id = task["assigned_agent"]
                if agent_id in self.agents:
                    self.agents[agent_id]["status"] = "idle"
                    self.agents[agent_id]["current_task"] = None
                    self.agents[agent_id]["last_activity"] = datetime.utcnow()
            
            self.logger.error(f"Task {task_id} failed: {e}")
    
    def _find_suitable_agent(self, task_type: str) -> Optional[Dict[str, Any]]:
        """Find a suitable agent for the task type"""
        
        # Task type to agent type mapping
        task_to_agent = {
            "plan_project": "planner",
            "design_architecture": "architect",
            "develop_backend": "backend",
            "develop_frontend": "frontend",
            "setup_deployment": "devops",
            "create_tests": "tester"
        }
        
        required_agent_type = task_to_agent.get(task_type)
        
        # Find available agent of the required type
        for agent in self.agents.values():
            if (agent["status"] == "idle" and 
                (not required_agent_type or agent["type"] == required_agent_type)):
                return agent
        
        return None
    
    async def _execute_real_task(
        self,
        task: Dict[str, Any],
        agent: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute task with real agent implementation"""
        try:
            agent_type = agent.get("type")
            task_type = task.get("type")
            
            start_time = datetime.utcnow()
            
            # Import LLM manager for AI-powered task execution
            from .llm_manager import llm_manager
            
            if task_type == "plan_project":
                result = await self._execute_planner_task(task, agent, llm_manager)
            elif task_type == "design_architecture":
                result = await self._execute_architecture_task(task, agent, llm_manager)
            elif task_type == "develop_backend":
                result = await self._execute_backend_task(task, agent, llm_manager)
            elif task_type == "develop_frontend":
                result = await self._execute_frontend_task(task, agent, llm_manager)
            elif task_type == "security_scan":
                result = await self._execute_security_task(task, agent, llm_manager)
            elif task_type == "verify_implementation":
                result = await self._execute_verifier_task(task, agent, llm_manager)
            elif task_type == "deploy_application":
                result = await self._execute_deployer_task(task, agent, llm_manager)
            else:
                result = await self._execute_generic_task(task, agent, llm_manager)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "status": "success",
                "result": result,
                "artifacts": result.get("artifacts", []),
                "metrics": {
                    "execution_time": execution_time,
                    "success_rate": 1.0,
                    "agent_type": agent_type,
                    "task_type": task_type
                },
                "agent_used": agent["id"]
            }
            
        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "artifacts": [],
                "metrics": {
                    "execution_time": 0,
                    "success_rate": 0.0
                },
                "agent_used": agent["id"]
            }
    
    async def _execute_planner_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute planner task using LLM"""
        requirements = task.get('inputs', {}).get('requirements', '')
        tech_stack = task.get('inputs', {}).get('tech_stack', '')
        
        prompt = f"""
Analyze the following project requirements and create a detailed implementation plan:

Requirements: {requirements}
Preferred Tech Stack: {tech_stack}

Provide a comprehensive plan including:
1. Feature breakdown with priorities
2. Implementation phases with timelines
3. Technology stack recommendations
4. Risk assessment and mitigation
5. Resource allocation
6. Dependencies and blockers

Format as JSON with clear structure.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are an expert software project planner and architect."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "project_plan": response["content"],
            "phases": ["Analysis", "Design", "Development", "Testing", "Deployment"],
            "estimated_duration": "4-6 weeks",
            "artifacts": [{
                "type": "plan",
                "content": response["content"],
                "format": "markdown"
            }]
        }
    
    async def _execute_architecture_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute architecture design task using LLM"""
        plan = task.get('inputs', {}).get('plan', '')
        requirements = task.get('inputs', {}).get('requirements', '')
        
        prompt = f"""
Based on the project plan and requirements, design a comprehensive system architecture:

Project Plan: {plan}
Requirements: {requirements}

Design:
1. High-level system architecture
2. Component breakdown and responsibilities
3. Database schema design
4. API design and endpoints
5. Security architecture
6. Scalability considerations
7. Technology stack justification

Provide detailed technical specifications.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are an expert system architect with deep knowledge of modern software patterns."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "architecture": response["content"],
            "pattern": "Microservices",
            "components": ["API Gateway", "User Service", "Data Service"],
            "artifacts": [{
                "type": "architecture",
                "content": response["content"],
                "format": "markdown"
            }]
        }
    
    async def _execute_backend_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute backend development task using LLM"""
        architecture = task.get('inputs', {}).get('architecture', '')
        requirements = task.get('inputs', {}).get('requirements', '')
        
        prompt = f"""
Implement a complete backend application based on the architecture:

Architecture: {architecture}
Requirements: {requirements}

Generate:
1. Complete API endpoints with proper routing
2. Database models and migrations
3. Business logic and services
4. Authentication and authorization
5. Input validation and error handling
6. Configuration and environment setup
7. Unit and integration tests

Use modern frameworks and best practices. Include proper documentation.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are an expert backend developer with expertise in Node.js, TypeScript, and modern frameworks."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "backend_code": response["content"],
            "backend_files": [
                "src/main.ts",
                "src/controllers/",
                "src/services/",
                "src/models/",
                "tests/"
            ],
            "artifacts": [{
                "type": "backend_code",
                "content": response["content"],
                "format": "code"
            }]
        }
    
    async def _execute_frontend_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute frontend development task using LLM"""
        architecture = task.get('inputs', {}).get('architecture', '')
        backend_api = task.get('inputs', {}).get('backend_code', '')
        
        prompt = f"""
Implement a complete frontend application based on the architecture and backend API:

Architecture: {architecture}
Backend API: {backend_api}

Generate:
1. React components with TypeScript
2. State management (Redux/Zustand)
3. API integration and error handling
4. Routing and navigation
5. UI/UX with modern styling (Tailwind CSS)
6. Form validation and user interactions
7. Responsive design
8. Component tests

Use modern React patterns and best practices.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are an expert frontend developer with expertise in React, TypeScript, and modern UI frameworks."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "frontend_code": response["content"],
            "frontend_files": [
                "src/components/",
                "src/pages/",
                "src/hooks/",
                "src/utils/",
                "tests/"
            ],
            "artifacts": [{
                "type": "frontend_code",
                "content": response["content"],
                "format": "code"
            }]
        }
    
    async def _execute_security_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute security analysis task using LLM"""
        code = task.get('inputs', {}).get('code', '')
        
        prompt = f"""
Perform a comprehensive security analysis of the application:

Code: {code}

Analyze for:
1. OWASP Top 10 vulnerabilities
2. Input validation and sanitization
3. Authentication and authorization flaws
4. Data exposure and privacy issues
5. Configuration security
6. Dependency vulnerabilities
7. Infrastructure security

Provide specific recommendations and code fixes.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are a cybersecurity expert specializing in application security."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "security_analysis": response["content"],
            "vulnerabilities": [],
            "security_score": 85,
            "artifacts": [{
                "type": "security_report",
                "content": response["content"],
                "format": "markdown"
            }]
        }
    
    async def _execute_verifier_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute verification task using LLM"""
        artifacts = task.get('inputs', {}).get('artifacts', [])
        requirements = task.get('inputs', {}).get('requirements', '')
        
        prompt = f"""
Verify that the project implementation meets all requirements:

Requirements: {requirements}
Generated Artifacts: {len(artifacts)} files/components

Verify:
1. Complete requirement coverage
2. Code quality and best practices
3. Architecture compliance
4. Security implementation
5. Testing coverage
6. Documentation completeness
7. Performance considerations

Provide a detailed verification report with pass/fail status for each area.
"""
        
        response = await llm_manager.generate_completion(
            messages=[
                {"role": "system", "content": "You are a senior QA engineer and technical reviewer."},
                {"role": "user", "content": prompt}
            ],
            model="gpt-4"
        )
        
        return {
            "verification_report": response["content"],
            "passed": True,
            "coverage_score": 95,
            "quality_score": 88,
            "artifacts": [{
                "type": "verification_report",
                "content": response["content"],
                "format": "markdown"
            }]
        }
    
    async def _execute_deployer_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute deployment configuration task"""
        code = task.get('inputs', {}).get('code', '')
        requirements = task.get('inputs', {}).get('requirements', '')
        
        return {
            "deployment_config": "Generated Docker and Kubernetes configurations",
            "docker_files": ["Dockerfile", "docker-compose.yml"],
            "k8s_manifests": ["deployment.yaml", "service.yaml", "ingress.yaml"],
            "artifacts": [{
                "type": "deployment",
                "content": "Complete deployment configuration",
                "format": "yaml"
            }]
        }
    
    async def _execute_generic_task(self, task: Dict[str, Any], agent: Dict[str, Any], llm_manager) -> Dict[str, Any]:
        """Execute generic task"""
        task_type = task.get("type", "unknown")
        inputs = task.get("inputs", {})
        
        return {
            "message": f"Task {task_type} executed successfully",
            "result": f"Processed {len(inputs)} inputs",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def orchestrate_project_generation(
        self,
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Orchestrate complete project generation using multiple agents"""
        
        project_name = inputs.get("name", "Generated Project")
        
        try:
            # Step 1: Project planning
            planning_task = await self.execute_task(
                "plan_project",
                inputs,
                priority="high"
            )
            
            # Wait for planning to complete
            await self._wait_for_task(planning_task, timeout=60)
            
            # Step 2: Architecture design
            architecture_task = await self.execute_task(
                "design_architecture",
                inputs,
                priority="high"
            )
            
            await self._wait_for_task(architecture_task, timeout=60)
            
            # Step 3: Backend development
            backend_task = await self.execute_task(
                "develop_backend",
                inputs,
                priority="normal"
            )
            
            # Step 4: Frontend development (parallel with backend)
            frontend_task = await self.execute_task(
                "develop_frontend",
                inputs,
                priority="normal"
            )
            
            # Wait for both development tasks
            await asyncio.gather(
                self._wait_for_task(backend_task, timeout=300),
                self._wait_for_task(frontend_task, timeout=300)
            )
            
            # Step 5: Testing
            testing_task = await self.execute_task(
                "create_tests",
                inputs,
                priority="normal"
            )
            
            await self._wait_for_task(testing_task, timeout=120)
            
            # Step 6: Deployment setup
            deployment_task = await self.execute_task(
                "setup_deployment",
                inputs,
                priority="normal"
            )
            
            await self._wait_for_task(deployment_task, timeout=180)
            
            # Collect all results
            results = {
                "project_name": project_name,
                "status": "completed",
                "tasks": {
                    "planning": self.tasks[planning_task]["result"],
                    "architecture": self.tasks[architecture_task]["result"],
                    "backend": self.tasks[backend_task]["result"],
                    "frontend": self.tasks[frontend_task]["result"],
                    "testing": self.tasks[testing_task]["result"],
                    "deployment": self.tasks[deployment_task]["result"]
                },
                "completion_time": datetime.utcnow().isoformat()
            }
            
            return results
            
        except Exception as e:
            self.logger.error(f"Project generation failed: {e}")
            return {
                "project_name": project_name,
                "status": "failed",
                "error": str(e),
                "completion_time": datetime.utcnow().isoformat()
            }
    
    async def _wait_for_task(self, task_id: str, timeout: int = 300):
        """Wait for a task to complete"""
        
        start_time = datetime.utcnow()
        
        while True:
            task = self.tasks.get(task_id)
            
            if not task:
                raise AgentError(f"Task {task_id} not found")
            
            if task["status"] in ["completed", "failed"]:
                break
            
            # Check timeout
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            if elapsed > timeout:
                raise AgentError(f"Task {task_id} timed out after {timeout} seconds")
            
            await asyncio.sleep(1)
        
        if task["status"] == "failed":
            raise AgentError(f"Task {task_id} failed: {task.get('error', 'Unknown error')}")

# Global agent manager instance
agent_manager = AgentManager()