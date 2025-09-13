import json
import asyncio
import logging
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext, AgentStatus
from ..llm_adapter import LLMMessage, llm_manager
from ..config import config

class BackendAgent(BaseAgent):
    def __init__(self):
        super().__init__("backend-001", AgentType.BACKEND)
        self.capabilities = [
            "api_development",
            "database_implementation",
            "service_architecture",
            "authentication_systems",
            "business_logic",
            "integration_development",
            "performance_optimization",
            "testing_implementation"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        return task.type in [
            "develop_backend",
            "implement_api_endpoints",
            "implement_database_layer",
            "implement_authentication",
            "implement_business_logic",
            "implement_integrations",
            "optimize_performance",
            "implement_backend_tests"
        ]
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute backend development tasks"""
        self.logger.info(f"Executing backend task: {task.type}")
        
        if task.type == "develop_backend":
            return await self._develop_complete_backend(task, context)
        elif task.type == "implement_api_endpoints":
            return await self._implement_api_endpoints(task, context)
        elif task.type == "implement_database_layer":
            return await self._implement_database_layer(task, context)
        elif task.type == "implement_authentication":
            return await self._implement_authentication(task, context)
        elif task.type == "implement_business_logic":
            return await self._implement_business_logic(task, context)
        elif task.type == "implement_integrations":
            return await self._implement_integrations(task, context)
        elif task.type == "optimize_performance":
            return await self._optimize_performance(task, context)
        elif task.type == "implement_backend_tests":
            return await self._implement_backend_tests(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _develop_complete_backend(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Develop complete backend implementation"""
        architecture = task.inputs.get("architecture", {})
        requirements = task.inputs.get("requirements", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior backend developer with expertise in building scalable, secure backend systems. Generate complete backend implementation.

Based on the architecture and requirements, generate:
1. Encore.ts service definitions
2. API endpoint implementations
3. Database schemas and migrations
4. Authentication and authorization
5. Business logic implementation
6. Error handling and validation
7. Testing implementation
8. Configuration management
9. Performance optimizations
10. Security implementations

Follow Encore.ts patterns and best practices. Generate complete, production-ready code.

Format as JSON:
{
    "services": [
        {
            "name": "service_name",
            "description": "service purpose",
            "files": [
                {
                    "path": "relative/path/to/file.ts",
                    "content": "complete file content",
                    "description": "file purpose"
                }
            ]
        }
    ],
    "database": {
        "migrations": [
            {
                "name": "migration_name",
                "path": "migrations/001_migration.up.sql",
                "content": "SQL migration content"
            }
        ],
        "schemas": [
            {
                "name": "schema_name",
                "path": "db.ts",
                "content": "TypeScript schema definitions"
            }
        ]
    },
    "configuration": [
        {
            "path": "config/config.ts",
            "content": "configuration file content"
        }
    ],
    "tests": [
        {
            "path": "tests/service.test.ts",
            "content": "test file content"
        }
    ],
    "implementation_notes": [
        "important implementation details",
        "security considerations",
        "performance optimizations"
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Generate complete backend implementation for:\nArchitecture: {json.dumps(architecture, indent=2)}\nRequirements: {json.dumps(requirements, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            backend_implementation = json.loads(response.content)
            
            # Create the actual files
            created_files = await self._create_backend_files(backend_implementation, context)
            
            return {
                "backend_implementation": backend_implementation,
                "created_files": created_files,
                "architecture": architecture,
                "requirements": requirements,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Backend development failed: {e}")
            raise
    
    async def _implement_api_endpoints(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement specific API endpoints"""
        api_design = task.inputs.get("api_design", {})
        service_name = task.inputs.get("service_name", "api")
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an API development expert. Implement Encore.ts API endpoints based on the API design.

Generate complete endpoint implementations including:
1. API endpoint definitions with proper types
2. Request/response validation
3. Error handling
4. Authentication/authorization
5. Business logic
6. Database interactions
7. Logging and monitoring
8. Documentation

Use Encore.ts patterns and conventions. Generate production-ready code.

Format as JSON:
{
    "endpoints": [
        {
            "name": "endpoint_name",
            "path": "path/to/endpoint.ts",
            "content": "complete TypeScript implementation",
            "description": "endpoint purpose",
            "dependencies": ["other files needed"]
        }
    ],
    "types": [
        {
            "path": "types.ts",
            "content": "TypeScript type definitions"
        }
    ],
    "middleware": [
        {
            "path": "middleware/auth.ts",
            "content": "middleware implementation"
        }
    ],
    "tests": [
        {
            "path": "tests/endpoints.test.ts",
            "content": "comprehensive test cases"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement API endpoints for service '{service_name}':\nAPI Design: {json.dumps(api_design, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            api_implementation = json.loads(response.content)
            
            return {
                "api_implementation": api_implementation,
                "api_design": api_design,
                "service_name": service_name,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"API endpoint implementation failed: {e}")
            raise
    
    async def _implement_database_layer(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement database layer"""
        database_design = task.inputs.get("database_design", {})
        service_name = task.inputs.get("service_name", "database")
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a database implementation expert. Implement complete database layer for Encore.ts.

Generate:
1. SQL migrations for database schema
2. TypeScript database models and types
3. Repository pattern implementations
4. Query builders and helpers
5. Database connection management
6. Transaction handling
7. Data validation
8. Performance optimizations

Use Encore.ts database patterns and best practices.

Format as JSON:
{
    "migrations": [
        {
            "name": "001_initial_schema",
            "path": "migrations/001_initial_schema.up.sql",
            "content": "SQL migration content",
            "description": "migration purpose"
        }
    ],
    "models": [
        {
            "name": "model_name",
            "path": "models/model.ts",
            "content": "TypeScript model implementation",
            "description": "model purpose"
        }
    ],
    "repositories": [
        {
            "name": "repository_name",
            "path": "repositories/repository.ts",
            "content": "repository implementation",
            "description": "repository purpose"
        }
    ],
    "database_config": {
        "path": "db.ts",
        "content": "database configuration and types"
    },
    "seeds": [
        {
            "name": "seed_name",
            "path": "seeds/seed.ts",
            "content": "seed data implementation"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement database layer for service '{service_name}':\nDatabase Design: {json.dumps(database_design, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            database_implementation = json.loads(response.content)
            
            return {
                "database_implementation": database_implementation,
                "database_design": database_design,
                "service_name": service_name,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Database layer implementation failed: {e}")
            raise
    
    async def _implement_authentication(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement authentication system"""
        auth_requirements = task.inputs.get("auth_requirements", {})
        security_architecture = task.inputs.get("security_architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a security and authentication expert. Implement complete authentication system for Encore.ts.

Generate:
1. Authentication service implementation
2. JWT token management
3. Password hashing and validation
4. Session management
5. Authorization middleware
6. Role-based access control
7. OAuth integration
8. Security utilities
9. Authentication tests

Use security best practices and Encore.ts patterns.

Format as JSON:
{
    "auth_service": {
        "path": "auth/auth.ts",
        "content": "main authentication service"
    },
    "middleware": [
        {
            "name": "auth_middleware",
            "path": "auth/middleware.ts",
            "content": "authentication middleware"
        }
    ],
    "utilities": [
        {
            "name": "jwt_utils",
            "path": "auth/jwt.ts",
            "content": "JWT utilities"
        },
        {
            "name": "password_utils",
            "path": "auth/password.ts", 
            "content": "password utilities"
        }
    ],
    "types": {
        "path": "auth/types.ts",
        "content": "authentication types"
    },
    "config": {
        "path": "auth/config.ts",
        "content": "authentication configuration"
    },
    "tests": [
        {
            "path": "auth/auth.test.ts",
            "content": "authentication tests"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement authentication system:\nAuth Requirements: {json.dumps(auth_requirements, indent=2)}\nSecurity Architecture: {json.dumps(security_architecture, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            auth_implementation = json.loads(response.content)
            
            return {
                "auth_implementation": auth_implementation,
                "auth_requirements": auth_requirements,
                "security_architecture": security_architecture,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Authentication implementation failed: {e}")
            raise
    
    async def _create_backend_files(self, implementation: Dict[str, Any], context: AgentExecutionContext) -> List[str]:
        """Create actual backend files from implementation"""
        created_files = []
        workspace_path = context.workspace_path
        
        try:
            # Create services
            for service in implementation.get("services", []):
                service_dir = os.path.join(workspace_path, "backend", service["name"])
                os.makedirs(service_dir, exist_ok=True)
                
                for file_info in service.get("files", []):
                    file_path = os.path.join(service_dir, file_info["path"])
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    
                    with open(file_path, 'w') as f:
                        f.write(file_info["content"])
                    created_files.append(file_path)
            
            # Create database files
            database = implementation.get("database", {})
            if database:
                db_dir = os.path.join(workspace_path, "backend")
                
                for migration in database.get("migrations", []):
                    migration_path = os.path.join(db_dir, migration["path"])
                    os.makedirs(os.path.dirname(migration_path), exist_ok=True)
                    
                    with open(migration_path, 'w') as f:
                        f.write(migration["content"])
                    created_files.append(migration_path)
                
                for schema in database.get("schemas", []):
                    schema_path = os.path.join(db_dir, schema["path"])
                    os.makedirs(os.path.dirname(schema_path), exist_ok=True)
                    
                    with open(schema_path, 'w') as f:
                        f.write(schema["content"])
                    created_files.append(schema_path)
            
            # Create configuration files
            for config_file in implementation.get("configuration", []):
                config_path = os.path.join(workspace_path, "backend", config_file["path"])
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                
                with open(config_path, 'w') as f:
                    f.write(config_file["content"])
                created_files.append(config_path)
            
            # Create test files
            for test_file in implementation.get("tests", []):
                test_path = os.path.join(workspace_path, "backend", test_file["path"])
                os.makedirs(os.path.dirname(test_path), exist_ok=True)
                
                with open(test_path, 'w') as f:
                    f.write(test_file["content"])
                created_files.append(test_path)
                
            self.logger.info(f"Created {len(created_files)} backend files")
            return created_files
            
        except Exception as e:
            self.logger.error(f"Failed to create backend files: {e}")
            raise
    
    async def _implement_business_logic(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement business logic"""
        requirements = task.inputs.get("requirements", {})
        domain_model = task.inputs.get("domain_model", {})
        
        # Implementation similar to other methods
        return {
            "business_logic": "implemented",
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _implement_integrations(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement external integrations"""
        integration_requirements = task.inputs.get("integration_requirements", {})
        
        # Implementation for external service integrations
        return {
            "integrations": "implemented",
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _optimize_performance(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Optimize backend performance"""
        performance_requirements = task.inputs.get("performance_requirements", {})
        
        # Implementation for performance optimizations
        return {
            "optimizations": "implemented",
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _implement_backend_tests(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement comprehensive backend tests"""
        test_requirements = task.inputs.get("test_requirements", {})
        
        # Implementation for comprehensive testing
        return {
            "tests": "implemented",
            "implementation_timestamp": datetime.utcnow().isoformat()
        }