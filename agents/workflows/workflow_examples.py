"""
Example workflows and test cases for the agent system
"""

import asyncio
import json
from typing import Dict, Any
from .workflow_engine import workflow_engine, WorkflowEngine
from .predefined_workflows import get_workflow_template
from ..base_agent import AgentExecutionContext

class WorkflowExamples:
    """Collection of example workflows for testing and demonstration"""
    
    @staticmethod
    async def run_full_stack_example():
        """Run a complete full-stack development workflow example"""
        
        # Create execution context
        context = AgentExecutionContext(
            project_id="example-001",
            user_id="demo-user",
            requirements={
                "type": "web_application",
                "features": ["user_authentication", "project_management", "file_sharing"],
                "target_audience": "small_teams",
                "scalability": "moderate"
            },
            project_type="full_stack_web_app",
            tech_stack=["React", "Node.js", "PostgreSQL"],
            configuration={
                "deployment": "cloud",
                "database": "postgresql",
                "authentication": "jwt"
            },
            workspace_path="/tmp/example_project"
        )
        
        # Get workflow template
        template = get_workflow_template("full_stack_web_app")
        
        # Create workflow with specific inputs
        workflow_inputs = {
            "requirements": {
                "name": "Team Collaboration Platform",
                "description": "A platform for small teams to collaborate on projects",
                "features": [
                    "User registration and authentication",
                    "Project creation and management", 
                    "File sharing and version control",
                    "Real-time messaging",
                    "Task assignment and tracking"
                ],
                "user_roles": ["admin", "project_manager", "team_member"],
                "scalability_requirements": "Support up to 100 concurrent users",
                "performance_requirements": "Page load time < 2 seconds"
            },
            "team_skills": ["JavaScript", "React", "Node.js", "PostgreSQL", "Docker"],
            "design_system": {
                "color_scheme": "modern_blue",
                "typography": "sans_serif",
                "component_library": "custom"
            }
        }
        
        # Update template inputs with actual values
        for step in template["steps"]:
            for key, value in step["inputs"].items():
                if isinstance(value, str) and value.startswith("${workflow."):
                    workflow_key = value[2:-1].split(".")[-1]
                    if workflow_key in workflow_inputs:
                        step["inputs"][key] = workflow_inputs[workflow_key]
        
        # Create and execute workflow
        workflow_id = workflow_engine.create_workflow(
            name=template["name"],
            description=template["description"],
            steps=template["steps"],
            context=context
        )
        
        print(f"Created workflow: {workflow_id}")
        print("Starting workflow execution...")
        
        # Execute workflow
        result = await workflow_engine.execute_workflow(workflow_id)
        
        return result
    
    @staticmethod
    async def run_backend_api_example():
        """Run a backend API development workflow example"""
        
        context = AgentExecutionContext(
            project_id="api-001",
            user_id="demo-user",
            requirements={
                "type": "rest_api",
                "entities": ["users", "projects", "tasks", "files"],
                "authentication": "jwt",
                "database": "postgresql"
            },
            project_type="backend_api",
            tech_stack=["Node.js", "TypeScript", "PostgreSQL"],
            configuration={
                "framework": "encore",
                "testing": "jest",
                "documentation": "openapi"
            },
            workspace_path="/tmp/api_project"
        )
        
        template = get_workflow_template("backend_api_only")
        
        workflow_inputs = {
            "requirements": {
                "name": "Project Management API",
                "description": "RESTful API for project management system",
                "endpoints": [
                    "User CRUD operations",
                    "Project CRUD operations", 
                    "Task management",
                    "File upload/download",
                    "Authentication endpoints"
                ],
                "authentication": "JWT with refresh tokens",
                "rate_limiting": "100 requests per minute per user",
                "data_validation": "strict input validation"
            },
            "entities": ["users", "projects", "tasks", "files"],
            "test_scenarios": [
                "User registration and login",
                "Project creation and management",
                "Task assignment and updates",
                "File operations",
                "Error handling"
            ]
        }
        
        # Update template with inputs
        for step in template["steps"]:
            for key, value in step["inputs"].items():
                if isinstance(value, str) and value.startswith("${workflow."):
                    workflow_key = value[2:-1].split(".")[-1]
                    if workflow_key in workflow_inputs:
                        step["inputs"][key] = workflow_inputs[workflow_key]
        
        workflow_id = workflow_engine.create_workflow(
            name=template["name"],
            description=template["description"],
            steps=template["steps"],
            context=context
        )
        
        print(f"Created backend API workflow: {workflow_id}")
        result = await workflow_engine.execute_workflow(workflow_id)
        
        return result
    
    @staticmethod
    async def run_quick_prototype_example():
        """Run a quick prototype workflow example"""
        
        context = AgentExecutionContext(
            project_id="proto-001",
            user_id="demo-user",
            requirements={
                "type": "prototype",
                "concept": "AI-powered task scheduler",
                "timeline": "2 days",
                "complexity": "minimal"
            },
            project_type="quick_prototype",
            tech_stack=["React", "Node.js"],
            configuration={
                "database": "in_memory",
                "deployment": "local",
                "ui_framework": "react"
            },
            workspace_path="/tmp/prototype_project"
        )
        
        template = get_workflow_template("quick_prototype")
        
        workflow_inputs = {
            "concept": {
                "name": "Smart Task Scheduler",
                "description": "AI-powered task scheduling and prioritization tool",
                "core_features": [
                    "Task input and management",
                    "AI-based priority calculation",
                    "Schedule optimization",
                    "Simple dashboard view"
                ],
                "target_users": "busy professionals",
                "key_value_proposition": "Automatically optimize daily schedule"
            },
            "demo_scenarios": [
                "Add multiple tasks with deadlines",
                "View AI-generated schedule",
                "Modify task priorities",
                "Export schedule"
            ]
        }
        
        # Update template with inputs
        for step in template["steps"]:
            for key, value in step["inputs"].items():
                if isinstance(value, str) and value.startswith("${workflow."):
                    workflow_key = value[2:-1].split(".")[-1]
                    if workflow_key in workflow_inputs:
                        step["inputs"][key] = workflow_inputs[workflow_key]
        
        workflow_id = workflow_engine.create_workflow(
            name=template["name"],
            description=template["description"],
            steps=template["steps"],
            context=context
        )
        
        print(f"Created prototype workflow: {workflow_id}")
        result = await workflow_engine.execute_workflow(workflow_id)
        
        return result
    
    @staticmethod
    async def run_validation_example():
        """Run a comprehensive validation workflow example"""
        
        context = AgentExecutionContext(
            project_id="validation-001",
            user_id="demo-user",
            requirements={
                "validation_type": "full_suite",
                "quality_standards": "enterprise",
                "security_level": "high",
                "compliance": ["GDPR", "SOC2"]
            },
            project_type="validation",
            tech_stack=["TypeScript", "React", "Node.js"],
            configuration={
                "test_framework": "jest",
                "linting": "eslint",
                "security_scanning": "snyk"
            },
            workspace_path="/tmp/validation_project"
        )
        
        # Create a validation workflow
        validation_workflow = {
            "name": "Complete Validation Suite",
            "description": "Comprehensive validation and quality assurance",
            "steps": [
                {
                    "id": "code_quality_validation",
                    "name": "Code Quality Validation",
                    "agent_type": "validator",
                    "task_type": "validate_code_quality",
                    "inputs": {
                        "project_path": context.workspace_path,
                        "quality_standards": {
                            "max_complexity": 10,
                            "min_test_coverage": 80,
                            "max_duplicated_lines": 5
                        }
                    },
                    "dependencies": [],
                    "timeout": 300
                },
                {
                    "id": "security_validation",
                    "name": "Security Validation",
                    "agent_type": "validator",
                    "task_type": "validate_security",
                    "inputs": {
                        "project_path": context.workspace_path,
                        "security_requirements": {
                            "vulnerability_threshold": "medium",
                            "secret_scanning": True,
                            "dependency_audit": True
                        }
                    },
                    "dependencies": [],
                    "timeout": 600
                },
                {
                    "id": "functional_validation",
                    "name": "Functional Testing",
                    "agent_type": "validator",
                    "task_type": "validate_functionality",
                    "inputs": {
                        "project_path": context.workspace_path,
                        "functional_requirements": [
                            "User authentication works correctly",
                            "API endpoints return expected responses",
                            "Database operations are successful",
                            "Error handling is comprehensive"
                        ]
                    },
                    "dependencies": [],
                    "timeout": 900
                },
                {
                    "id": "full_validation_suite",
                    "name": "Complete Validation Report",
                    "agent_type": "validator",
                    "task_type": "run_full_validation_suite",
                    "inputs": {
                        "project_path": context.workspace_path,
                        "validation_config": {
                            "include_performance": True,
                            "include_compliance": True,
                            "include_documentation": True
                        }
                    },
                    "dependencies": ["code_quality_validation", "security_validation", "functional_validation"],
                    "timeout": 1200
                }
            ]
        }
        
        workflow_id = workflow_engine.create_workflow(
            name=validation_workflow["name"],
            description=validation_workflow["description"],
            steps=validation_workflow["steps"],
            context=context
        )
        
        print(f"Created validation workflow: {workflow_id}")
        result = await workflow_engine.execute_workflow(workflow_id)
        
        return result

async def run_all_examples():
    """Run all workflow examples"""
    
    print("=" * 80)
    print("AGENT SYSTEM WORKFLOW EXAMPLES")
    print("=" * 80)
    
    examples = [
        ("Quick Prototype", WorkflowExamples.run_quick_prototype_example),
        ("Backend API", WorkflowExamples.run_backend_api_example),
        ("Full Stack App", WorkflowExamples.run_full_stack_example),
        ("Validation Suite", WorkflowExamples.run_validation_example)
    ]
    
    results = {}
    
    for name, example_func in examples:
        print(f"\n{'=' * 40}")
        print(f"Running: {name}")
        print(f"{'=' * 40}")
        
        try:
            result = await example_func()
            results[name] = {
                "status": "success",
                "result": result
            }
            
            print(f"\n✅ {name} completed successfully!")
            print(f"Status: {result.get('status', 'unknown')}")
            print(f"Duration: {result.get('duration_seconds', 'unknown')} seconds")
            print(f"Steps completed: {result.get('summary', {}).get('completed_steps', 0)}")
            
        except Exception as e:
            results[name] = {
                "status": "error",
                "error": str(e)
            }
            print(f"\n❌ {name} failed: {e}")
    
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    
    successful = 0
    failed = 0
    
    for name, result in results.items():
        status_icon = "✅" if result["status"] == "success" else "❌"
        print(f"{status_icon} {name}: {result['status']}")
        
        if result["status"] == "success":
            successful += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(results)} workflows")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Success rate: {(successful / len(results) * 100):.1f}%")
    
    return results

if __name__ == "__main__":
    asyncio.run(run_all_examples())