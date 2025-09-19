"""
Predefined workflows for common development scenarios
"""

from typing import Dict, List, Any
from ..base_agent import AgentExecutionContext

class WorkflowTemplates:
    """Collection of predefined workflow templates"""
    
    @staticmethod
    def full_stack_web_app() -> Dict[str, Any]:
        """Complete full-stack web application development workflow"""
        return {
            "name": "Full-Stack Web Application",
            "description": "Complete development workflow for a full-stack web application",
            "steps": [
                {
                    "id": "requirements_analysis",
                    "name": "Requirements Analysis",
                    "agent_type": "planner",
                    "task_type": "analyze_requirements",
                    "inputs": {
                        "requirements": "${workflow.requirements}",
                        "description": "${workflow.description}"
                    },
                    "dependencies": [],
                    "timeout": 300
                },
                {
                    "id": "project_planning",
                    "name": "Project Planning",
                    "agent_type": "planner",
                    "task_type": "create_project_plan",
                    "inputs": {
                        "requirements_analysis": "${requirements_analysis.result.requirements_analysis}"
                    },
                    "dependencies": ["requirements_analysis"],
                    "timeout": 300
                },
                {
                    "id": "system_architecture",
                    "name": "System Architecture Design",
                    "agent_type": "architecture",
                    "task_type": "design_system_architecture",
                    "inputs": {
                        "requirements": "${requirements_analysis.result.requirements_analysis.functional_requirements}",
                        "non_functional_requirements": "${requirements_analysis.result.requirements_analysis.non_functional_requirements}",
                        "constraints": "${requirements_analysis.result.requirements_analysis.constraints}"
                    },
                    "dependencies": ["requirements_analysis"],
                    "timeout": 300
                },
                {
                    "id": "database_design",
                    "name": "Database Schema Design",
                    "agent_type": "architecture",
                    "task_type": "design_database_schema",
                    "inputs": {
                        "data_requirements": "${requirements_analysis.result.requirements_analysis.technical_requirements}",
                        "entities": ["User", "Project", "Task", "File"],
                        "business_rules": "${requirements_analysis.result.requirements_analysis.functional_requirements}"
                    },
                    "dependencies": ["requirements_analysis"],
                    "timeout": 300
                },
                {
                    "id": "api_design",
                    "name": "API Structure Design",
                    "agent_type": "architecture",
                    "task_type": "design_api_structure",
                    "inputs": {
                        "functional_requirements": "${requirements_analysis.result.requirements_analysis.functional_requirements}",
                        "user_stories": "${requirements_analysis.result.requirements_analysis.user_stories}"
                    },
                    "dependencies": ["requirements_analysis"],
                    "timeout": 300
                },
                {
                    "id": "tech_stack_selection",
                    "name": "Technology Stack Selection",
                    "agent_type": "architecture",
                    "task_type": "select_technology_stack",
                    "inputs": {
                        "requirements": "${requirements_analysis.result.requirements_analysis}",
                        "constraints": "${requirements_analysis.result.requirements_analysis.constraints}",
                        "team_skills": "${workflow.team_skills}"
                    },
                    "dependencies": ["requirements_analysis"],
                    "timeout": 300
                },
                {
                    "id": "backend_development",
                    "name": "Backend Development",
                    "agent_type": "backend",
                    "task_type": "develop_backend",
                    "inputs": {
                        "architecture": "${system_architecture.result.system_architecture}",
                        "database_design": "${database_design.result.database_design}",
                        "api_design": "${api_design.result.api_design}",
                        "requirements": "${requirements_analysis.result.requirements_analysis}"
                    },
                    "dependencies": ["system_architecture", "database_design", "api_design"],
                    "timeout": 600
                },
                {
                    "id": "frontend_development",
                    "name": "Frontend Development",
                    "agent_type": "frontend",
                    "task_type": "develop_frontend",
                    "inputs": {
                        "ui_requirements": "${requirements_analysis.result.requirements_analysis.user_interface}",
                        "api_design": "${api_design.result.api_design}",
                        "design_system": "${workflow.design_system}"
                    },
                    "dependencies": ["api_design"],
                    "timeout": 600
                },
                {
                    "id": "integration_testing",
                    "name": "Integration Testing",
                    "agent_type": "orchestrator",
                    "task_type": "integrate_deliverables",
                    "inputs": {
                        "backend_result": "${backend_development.result}",
                        "frontend_result": "${frontend_development.result}"
                    },
                    "dependencies": ["backend_development", "frontend_development"],
                    "timeout": 300
                },
                {
                    "id": "final_validation",
                    "name": "Final Validation",
                    "agent_type": "orchestrator",
                    "task_type": "validate_completion",
                    "inputs": {
                        "integration_result": "${integration_testing.result}",
                        "original_requirements": "${requirements_analysis.result.requirements_analysis}"
                    },
                    "dependencies": ["integration_testing"],
                    "timeout": 300
                }
            ]
        }
    
    @staticmethod
    def backend_api_only() -> Dict[str, Any]:
        """Backend API development workflow"""
        return {
            "name": "Backend API Development",
            "description": "Complete backend API development with database and authentication",
            "steps": [
                {
                    "id": "requirements_analysis",
                    "name": "Requirements Analysis",
                    "agent_type": "planner",
                    "task_type": "analyze_requirements",
                    "inputs": {
                        "requirements": "${workflow.requirements}",
                        "description": "${workflow.description}"
                    },
                    "dependencies": []
                },
                {
                    "id": "api_design",
                    "name": "API Design",
                    "agent_type": "architecture",
                    "task_type": "design_api_structure",
                    "inputs": {
                        "functional_requirements": "${requirements_analysis.result.requirements_analysis.functional_requirements}",
                        "user_stories": "${requirements_analysis.result.requirements_analysis.user_stories}"
                    },
                    "dependencies": ["requirements_analysis"]
                },
                {
                    "id": "database_design",
                    "name": "Database Design",
                    "agent_type": "architecture",
                    "task_type": "design_database_schema",
                    "inputs": {
                        "data_requirements": "${requirements_analysis.result.requirements_analysis.technical_requirements}",
                        "entities": "${workflow.entities}",
                        "business_rules": "${requirements_analysis.result.requirements_analysis.functional_requirements}"
                    },
                    "dependencies": ["requirements_analysis"]
                },
                {
                    "id": "backend_implementation",
                    "name": "Backend Implementation",
                    "agent_type": "backend",
                    "task_type": "develop_backend",
                    "inputs": {
                        "api_design": "${api_design.result.api_design}",
                        "database_design": "${database_design.result.database_design}",
                        "requirements": "${requirements_analysis.result.requirements_analysis}"
                    },
                    "dependencies": ["api_design", "database_design"],
                    "timeout": 600
                },
                {
                    "id": "api_testing",
                    "name": "API Testing",
                    "agent_type": "backend",
                    "task_type": "setup_testing",
                    "inputs": {
                        "api_endpoints": "${backend_implementation.result.api_endpoints}",
                        "test_scenarios": "${workflow.test_scenarios}"
                    },
                    "dependencies": ["backend_implementation"]
                }
            ]
        }
    
    @staticmethod
    def frontend_spa() -> Dict[str, Any]:
        """Single Page Application frontend workflow"""
        return {
            "name": "Frontend SPA Development",
            "description": "Complete frontend Single Page Application development",
            "steps": [
                {
                    "id": "ui_requirements_analysis",
                    "name": "UI Requirements Analysis",
                    "agent_type": "planner",
                    "task_type": "analyze_requirements",
                    "inputs": {
                        "requirements": "${workflow.ui_requirements}",
                        "description": "${workflow.description}"
                    },
                    "dependencies": []
                },
                {
                    "id": "component_design",
                    "name": "Component Design",
                    "agent_type": "frontend",
                    "task_type": "create_ui_components",
                    "inputs": {
                        "component_requirements": "${ui_requirements_analysis.result.requirements_analysis.functional_requirements}",
                        "design_system": "${workflow.design_system}"
                    },
                    "dependencies": ["ui_requirements_analysis"]
                },
                {
                    "id": "state_management_setup",
                    "name": "State Management",
                    "agent_type": "frontend",
                    "task_type": "implement_state_management",
                    "inputs": {
                        "state_requirements": "${ui_requirements_analysis.result.requirements_analysis.technical_requirements}",
                        "application_data": "${workflow.application_data}"
                    },
                    "dependencies": ["ui_requirements_analysis"]
                },
                {
                    "id": "frontend_implementation",
                    "name": "Frontend Implementation",
                    "agent_type": "frontend",
                    "task_type": "develop_frontend",
                    "inputs": {
                        "ui_requirements": "${ui_requirements_analysis.result.requirements_analysis}",
                        "components": "${component_design.result.ui_components}",
                        "state_management": "${state_management_setup.result.state_management}"
                    },
                    "dependencies": ["component_design", "state_management_setup"],
                    "timeout": 600
                },
                {
                    "id": "responsive_design",
                    "name": "Responsive Design",
                    "agent_type": "frontend",
                    "task_type": "create_responsive_design",
                    "inputs": {
                        "design_requirements": "${workflow.responsive_requirements}",
                        "target_devices": "${workflow.target_devices}"
                    },
                    "dependencies": ["frontend_implementation"]
                },
                {
                    "id": "frontend_testing",
                    "name": "Frontend Testing",
                    "agent_type": "frontend",
                    "task_type": "create_frontend_tests",
                    "inputs": {
                        "components": "${frontend_implementation.result.components}",
                        "user_flows": "${workflow.user_flows}"
                    },
                    "dependencies": ["frontend_implementation"]
                }
            ]
        }
    
    @staticmethod
    def microservices_architecture() -> Dict[str, Any]:
        """Microservices architecture development workflow"""
        return {
            "name": "Microservices Architecture",
            "description": "Complete microservices architecture design and implementation",
            "steps": [
                {
                    "id": "domain_analysis",
                    "name": "Domain Analysis",
                    "agent_type": "planner",
                    "task_type": "analyze_requirements",
                    "inputs": {
                        "requirements": "${workflow.requirements}",
                        "description": "${workflow.description}"
                    },
                    "dependencies": []
                },
                {
                    "id": "service_decomposition",
                    "name": "Service Decomposition",
                    "agent_type": "architecture",
                    "task_type": "design_system_architecture",
                    "inputs": {
                        "requirements": "${domain_analysis.result.requirements_analysis.functional_requirements}",
                        "constraints": ["microservices_pattern"],
                        "scalability_requirements": "${workflow.scalability_requirements}"
                    },
                    "dependencies": ["domain_analysis"]
                },
                {
                    "id": "api_gateway_design",
                    "name": "API Gateway Design",
                    "agent_type": "architecture",
                    "task_type": "design_api_structure",
                    "inputs": {
                        "service_architecture": "${service_decomposition.result.system_architecture}",
                        "routing_requirements": "${workflow.routing_requirements}"
                    },
                    "dependencies": ["service_decomposition"]
                },
                {
                    "id": "service_implementation",
                    "name": "Individual Service Implementation",
                    "agent_type": "backend",
                    "task_type": "develop_backend",
                    "inputs": {
                        "service_specs": "${service_decomposition.result.system_architecture.system_components}",
                        "api_design": "${api_gateway_design.result.api_design}",
                        "microservice_patterns": ["circuit_breaker", "service_discovery", "config_management"]
                    },
                    "dependencies": ["service_decomposition", "api_gateway_design"],
                    "timeout": 900
                },
                {
                    "id": "service_mesh_setup",
                    "name": "Service Mesh Configuration",
                    "agent_type": "architecture",
                    "task_type": "create_integration_plan",
                    "inputs": {
                        "services": "${service_implementation.result.services}",
                        "communication_patterns": ["REST", "gRPC", "Message Queue"]
                    },
                    "dependencies": ["service_implementation"]
                },
                {
                    "id": "deployment_orchestration",
                    "name": "Deployment Orchestration",
                    "agent_type": "orchestrator",
                    "task_type": "coordinate_development",
                    "inputs": {
                        "services": "${service_implementation.result}",
                        "infrastructure": "${service_mesh_setup.result}",
                        "deployment_strategy": "blue_green"
                    },
                    "dependencies": ["service_mesh_setup"]
                }
            ]
        }
    
    @staticmethod
    def quick_prototype() -> Dict[str, Any]:
        """Quick prototype development workflow"""
        return {
            "name": "Quick Prototype",
            "description": "Rapid prototype development for proof of concept",
            "steps": [
                {
                    "id": "concept_analysis",
                    "name": "Concept Analysis",
                    "agent_type": "planner",
                    "task_type": "analyze_requirements",
                    "inputs": {
                        "requirements": "${workflow.concept}",
                        "description": "${workflow.description}"
                    },
                    "dependencies": [],
                    "timeout": 120
                },
                {
                    "id": "tech_stack_quick_select",
                    "name": "Quick Tech Stack Selection",
                    "agent_type": "architecture",
                    "task_type": "select_technology_stack",
                    "inputs": {
                        "requirements": "${concept_analysis.result.requirements_analysis}",
                        "constraints": ["rapid_development", "minimal_setup"],
                        "team_skills": ["JavaScript", "React", "Node.js"]
                    },
                    "dependencies": ["concept_analysis"],
                    "timeout": 120
                },
                {
                    "id": "prototype_backend",
                    "name": "Prototype Backend",
                    "agent_type": "backend",
                    "task_type": "create_api",
                    "inputs": {
                        "endpoints": "${concept_analysis.result.requirements_analysis.functional_requirements}",
                        "database": "in_memory",
                        "authentication": "none"
                    },
                    "dependencies": ["tech_stack_quick_select"],
                    "timeout": 300
                },
                {
                    "id": "prototype_frontend",
                    "name": "Prototype Frontend",
                    "agent_type": "frontend",
                    "task_type": "implement_user_interface",
                    "inputs": {
                        "ui_requirements": "${concept_analysis.result.requirements_analysis}",
                        "design_system": "minimal",
                        "api_endpoints": "${prototype_backend.result.api_endpoints}"
                    },
                    "dependencies": ["prototype_backend"],
                    "timeout": 300
                },
                {
                    "id": "integration_demo",
                    "name": "Integration Demo",
                    "agent_type": "orchestrator",
                    "task_type": "integrate_deliverables",
                    "inputs": {
                        "backend": "${prototype_backend.result}",
                        "frontend": "${prototype_frontend.result}",
                        "demo_scenarios": "${workflow.demo_scenarios}"
                    },
                    "dependencies": ["prototype_frontend"],
                    "timeout": 180
                }
            ]
        }

def get_workflow_template(template_name: str) -> Dict[str, Any]:
    """Get a predefined workflow template by name"""
    templates = {
        "full_stack_web_app": WorkflowTemplates.full_stack_web_app,
        "backend_api_only": WorkflowTemplates.backend_api_only,
        "frontend_spa": WorkflowTemplates.frontend_spa,
        "microservices_architecture": WorkflowTemplates.microservices_architecture,
        "quick_prototype": WorkflowTemplates.quick_prototype
    }
    
    if template_name not in templates:
        available = ", ".join(templates.keys())
        raise ValueError(f"Unknown workflow template: {template_name}. Available: {available}")
    
    return templates[template_name]()

def list_workflow_templates() -> List[Dict[str, str]]:
    """List all available workflow templates"""
    return [
        {
            "name": "full_stack_web_app",
            "title": "Full-Stack Web Application",
            "description": "Complete development workflow for a full-stack web application"
        },
        {
            "name": "backend_api_only",
            "title": "Backend API Development",
            "description": "Complete backend API development with database and authentication"
        },
        {
            "name": "frontend_spa",
            "title": "Frontend SPA Development",
            "description": "Complete frontend Single Page Application development"
        },
        {
            "name": "microservices_architecture",
            "title": "Microservices Architecture",
            "description": "Complete microservices architecture design and implementation"
        },
        {
            "name": "quick_prototype",
            "title": "Quick Prototype",
            "description": "Rapid prototype development for proof of concept"
        }
    ]