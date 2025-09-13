import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
import uuid

class BackendAgent(BaseAgent):
    def __init__(self):
        super().__init__("backend-001", AgentType.BACKEND_DEVELOPER)
        self.capabilities = [
            "api_development",
            "database_design",
            "server_implementation",
            "authentication_setup",
            "api_documentation",
            "testing_framework",
            "security_implementation"
        ]
        self.supported_frameworks = [
            "express", "fastapi", "django", "spring", "rails", "encore"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        backend_tasks = [
            "develop_backend", "create_api", "setup_database",
            "implement_auth", "create_routes", "setup_middleware",
            "generate_api_docs", "setup_testing"
        ]
        return task.type in backend_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute backend development tasks"""
        if task.type == "develop_backend":
            return await self._develop_complete_backend(task, context)
        elif task.type == "create_api":
            return await self._create_api_endpoints(task, context)
        elif task.type == "setup_database":
            return await self._setup_database(task, context)
        elif task.type == "implement_auth":
            return await self._implement_authentication(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _develop_complete_backend(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Generate complete backend implementation"""
        self.logger.info(f"Developing complete backend for project: {context.project_id}")
        
        # Extract requirements from task inputs
        architecture = task.inputs.get("architecture", {})
        requirements = task.inputs.get("requirements", {})
        tech_stack = context.tech_stack
        
        # Determine backend framework
        framework = self._select_backend_framework(tech_stack, requirements)
        
        # Generate backend structure
        backend_structure = await self._generate_backend_structure(framework, requirements)
        
        # Generate API endpoints
        api_endpoints = await self._generate_api_endpoints(requirements, framework)
        
        # Generate database models
        database_models = await self._generate_database_models(requirements)
        
        # Generate authentication system
        auth_system = await self._generate_auth_system(framework, requirements)
        
        # Generate middleware and utilities
        middleware = await self._generate_middleware(framework, requirements)
        
        # Generate tests
        tests = await self._generate_backend_tests(framework, api_endpoints)
        
        # Generate configuration
        configuration = await self._generate_backend_config(framework, requirements)
        
        return {
            "framework": framework,
            "structure": backend_structure,
            "api_endpoints": api_endpoints,
            "database_models": database_models,
            "authentication": auth_system,
            "middleware": middleware,
            "tests": tests,
            "configuration": configuration,
            "files_generated": len(backend_structure["files"]),
            "quality_score": await self._calculate_backend_quality_score(
                api_endpoints, database_models, tests
            )
        }
    
    def _select_backend_framework(self, tech_stack: Dict[str, Any], requirements: Dict[str, Any]) -> str:
        """Select the most appropriate backend framework"""
        preferred = tech_stack.get("backend_framework", "").lower()
        
        if preferred in self.supported_frameworks:
            return preferred
        
        # Default selection based on requirements
        if requirements.get("real_time", False):
            return "express"  # Good WebSocket support
        elif requirements.get("ai_integration", False):
            return "fastapi"  # Good for ML integration
        elif requirements.get("enterprise", False):
            return "spring"   # Enterprise features
        else:
            return "express"  # Most versatile
    
    async def _generate_backend_structure(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate backend project structure"""
        if framework == "express":
            return await self._generate_express_structure(requirements)
        elif framework == "fastapi":
            return await self._generate_fastapi_structure(requirements)
        elif framework == "encore":
            return await self._generate_encore_structure(requirements)
        else:
            return await self._generate_generic_structure(framework, requirements)
    
    async def _generate_express_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Express.js project structure"""
        base_structure = {
            "directories": [
                "src/",
                "src/controllers/",
                "src/models/",
                "src/routes/",
                "src/middleware/",
                "src/services/",
                "src/utils/",
                "src/config/",
                "tests/",
                "tests/unit/",
                "tests/integration/"
            ],
            "files": [
                {
                    "path": "package.json",
                    "content": self._generate_express_package_json(requirements),
                    "description": "Project dependencies and scripts"
                },
                {
                    "path": "src/app.ts",
                    "content": self._generate_express_app_file(requirements),
                    "description": "Main application setup"
                },
                {
                    "path": "src/server.ts",
                    "content": self._generate_express_server_file(),
                    "description": "Server entry point"
                },
                {
                    "path": "tsconfig.json",
                    "content": self._generate_typescript_config(),
                    "description": "TypeScript configuration"
                },
                {
                    "path": ".env.example",
                    "content": self._generate_env_template(requirements),
                    "description": "Environment variables template"
                }
            ]
        }
        
        # Add additional files based on requirements
        if requirements.get("database", True):
            base_structure["files"].append({
                "path": "src/database.ts",
                "content": self._generate_database_connection(),
                "description": "Database connection setup"
            })
        
        if requirements.get("authentication", True):
            base_structure["files"].append({
                "path": "src/middleware/auth.ts",
                "content": self._generate_auth_middleware(),
                "description": "Authentication middleware"
            })
        
        return base_structure
    
    async def _generate_encore_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Encore.ts project structure"""
        services = requirements.get("services", ["main"])
        
        base_structure = {
            "directories": [
                "backend/",
            ] + [f"backend/{service}/" for service in services],
            "files": []
        }
        
        # Generate service files
        for service in services:
            base_structure["files"].extend([
                {
                    "path": f"backend/{service}/encore.service.ts",
                    "content": self._generate_encore_service_file(service),
                    "description": f"Encore service definition for {service}"
                },
                {
                    "path": f"backend/{service}/types.ts",
                    "content": self._generate_encore_types(service, requirements),
                    "description": f"Type definitions for {service} service"
                }
            ])
            
            # Generate API endpoints based on service
            endpoints = self._get_service_endpoints(service, requirements)
            for endpoint in endpoints:
                base_structure["files"].append({
                    "path": f"backend/{service}/{endpoint['name']}.ts",
                    "content": self._generate_encore_endpoint(endpoint, service),
                    "description": f"{endpoint['description']} endpoint"
                })
        
        return base_structure
    
    def _generate_express_package_json(self, requirements: Dict[str, Any]) -> str:
        """Generate package.json for Express project"""
        dependencies = {
            "express": "^4.18.2",
            "@types/express": "^4.17.21",
            "typescript": "^5.3.3",
            "ts-node": "^10.9.1",
            "cors": "^2.8.5",
            "@types/cors": "^2.8.17",
            "helmet": "^7.1.0",
            "dotenv": "^16.3.1",
            "compression": "^1.7.4",
            "@types/compression": "^1.7.5"
        }
        
        if requirements.get("database", True):
            dependencies.update({
                "pg": "^8.11.3",
                "@types/pg": "^8.10.9",
                "typeorm": "^0.3.17"
            })
        
        if requirements.get("authentication", True):
            dependencies.update({
                "jsonwebtoken": "^9.0.2",
                "@types/jsonwebtoken": "^9.0.6",
                "bcryptjs": "^2.4.3",
                "@types/bcryptjs": "^2.4.6"
            })
        
        if requirements.get("validation", True):
            dependencies["joi"] = "^17.11.0"
        
        package = {
            "name": requirements.get("name", "backend-api"),
            "version": "1.0.0",
            "description": requirements.get("description", "Backend API"),
            "main": "dist/server.js",
            "scripts": {
                "start": "node dist/server.js",
                "dev": "ts-node src/server.ts",
                "build": "tsc",
                "test": "jest",
                "lint": "eslint src/**/*.ts"
            },
            "dependencies": dependencies,
            "devDependencies": {
                "@types/node": "^20.10.4",
                "jest": "^29.7.0",
                "@types/jest": "^29.5.8",
                "ts-jest": "^29.1.1",
                "eslint": "^8.55.0",
                "@typescript-eslint/eslint-plugin": "^6.13.1",
                "@typescript-eslint/parser": "^6.13.1",
                "nodemon": "^3.0.2"
            }
        }
        
        return json.dumps(package, indent=2)
    
    def _generate_express_app_file(self, requirements: Dict[str, Any]) -> str:
        """Generate main Express app file"""
        return '''import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;'''
    
    async def _calculate_backend_quality_score(self, api_endpoints: List[Dict], database_models: List[Dict], tests: List[Dict]) -> float:
        """Calculate quality score for backend implementation"""
        score = 0.0
        max_score = 100.0
        
        # API endpoints quality (40 points)
        if api_endpoints:
            endpoint_score = min(40, len(api_endpoints) * 5)
            score += endpoint_score
        
        # Database models quality (30 points)
        if database_models:
            model_score = min(30, len(database_models) * 6)
            score += model_score
        
        # Test coverage (30 points)
        if tests:
            test_score = min(30, len(tests) * 5)
            score += test_score
        
        return min(100.0, (score / max_score) * 100)
    
    # Additional helper methods would be implemented here...
    def _generate_encore_service_file(self, service_name: str) -> str:
        return f'''import {{ Service }} from "encore.dev/service";

export default new Service("{service_name}");'''
    
    def _generate_encore_types(self, service_name: str, requirements: Dict[str, Any]) -> str:
        return f'''// Type definitions for {service_name} service

export interface {service_name.capitalize()}Request {{
  // Add request types here
}}

export interface {service_name.capitalize()}Response {{
  // Add response types here
}}'''
    
    def _get_service_endpoints(self, service: str, requirements: Dict[str, Any]) -> List[Dict]:
        """Get endpoints for a service based on requirements"""
        if service == "users":
            return [
                {"name": "create", "description": "Create user"},
                {"name": "get", "description": "Get user"},
                {"name": "list", "description": "List users"},
                {"name": "update", "description": "Update user"},
                {"name": "delete", "description": "Delete user"}
            ]
        elif service == "projects":
            return [
                {"name": "create", "description": "Create project"},
                {"name": "get", "description": "Get project"},
                {"name": "list", "description": "List projects"},
                {"name": "update", "description": "Update project"},
                {"name": "delete", "description": "Delete project"}
            ]
        else:
            return [
                {"name": "main", "description": "Main endpoint"}
            ]
    
    def _generate_encore_endpoint(self, endpoint: Dict, service: str) -> str:
        endpoint_name = endpoint["name"]
        description = endpoint["description"]
        
        return f'''import {{ api }} from "encore.dev/api";

interface {endpoint_name.capitalize()}Request {{
  // Add request interface here
}}

interface {endpoint_name.capitalize()}Response {{
  // Add response interface here
}}

// {description}
export const {endpoint_name} = api<{endpoint_name.capitalize()}Request, {endpoint_name.capitalize()}Response>(
  {{ method: "POST", path: "/{service}/{endpoint_name}", expose: true }},
  async (req) => {{
    // Implementation here
    return {{}};
  }}
);'''
    
    # Placeholder methods for other framework structures
    async def _generate_fastapi_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {"directories": [], "files": []}
    
    async def _generate_generic_structure(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {"directories": [], "files": []}
    
    async def _generate_api_endpoints(self, requirements: Dict[str, Any], framework: str) -> List[Dict]:
        return []
    
    async def _generate_database_models(self, requirements: Dict[str, Any]) -> List[Dict]:
        return []
    
    async def _generate_auth_system(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {}
    
    async def _generate_middleware(self, framework: str, requirements: Dict[str, Any]) -> List[Dict]:
        return []
    
    async def _generate_backend_tests(self, framework: str, api_endpoints: List[Dict]) -> List[Dict]:
        return []
    
    async def _generate_backend_config(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {}
    
    def _generate_express_server_file(self) -> str:
        return "// Express server file"
    
    def _generate_typescript_config(self) -> str:
        return "{}"
    
    def _generate_env_template(self, requirements: Dict[str, Any]) -> str:
        return "# Environment variables"
    
    def _generate_database_connection(self) -> str:
        return "// Database connection"
    
    def _generate_auth_middleware(self) -> str:
        return "// Auth middleware"