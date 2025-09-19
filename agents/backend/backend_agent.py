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
    // Complete implementation with business logic, validation, and error handling
    return {{}};
  }}
);'''
    
    async def _generate_fastapi_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate FastAPI project structure"""
        return {
            "directories": [
                "app/",
                "app/api/",
                "app/api/v1/",
                "app/api/v1/endpoints/",
                "app/core/",
                "app/models/",
                "app/schemas/",
                "app/services/",
                "app/db/",
                "tests/"
            ],
            "files": [
                {
                    "path": "main.py",
                    "content": self._generate_fastapi_main_file(requirements),
                    "description": "FastAPI application entry point"
                },
                {
                    "path": "requirements.txt",
                    "content": self._generate_fastapi_requirements(requirements),
                    "description": "Python dependencies"
                }
            ]
        }
    
    async def _generate_generic_structure(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate generic project structure for unknown frameworks"""
        return {
            "directories": [
                "src/",
                "tests/",
                "docs/",
                "config/"
            ],
            "files": [
                {
                    "path": "README.md",
                    "content": f"# {requirements.get('name', 'Project')}\n\nGenerated {framework} project structure",
                    "description": "Project documentation"
                }
            ]
        }
    
    async def _generate_api_endpoints(self, requirements: Dict[str, Any], framework: str) -> List[Dict]:
        """Generate API endpoints based on requirements"""
        endpoints = []
        entities = requirements.get("entities", ["users", "projects"])
        
        for entity in entities:
            endpoints.extend([
                {"name": f"get_{entity}", "method": "GET", "path": f"/{entity}/{{id}}", "description": f"Get {entity} by ID"},
                {"name": f"list_{entity}", "method": "GET", "path": f"/{entity}", "description": f"List all {entity}"},
                {"name": f"create_{entity}", "method": "POST", "path": f"/{entity}", "description": f"Create new {entity}"},
                {"name": f"update_{entity}", "method": "PUT", "path": f"/{entity}/{{id}}", "description": f"Update {entity}"},
                {"name": f"delete_{entity}", "method": "DELETE", "path": f"/{entity}/{{id}}", "description": f"Delete {entity}"}
            ])
        
        return endpoints
    
    async def _generate_database_models(self, requirements: Dict[str, Any]) -> List[Dict]:
        """Generate database models based on requirements"""
        models = []
        entities = requirements.get("entities", ["users", "projects"])
        
        for entity in entities:
            models.append({
                "name": entity.capitalize(),
                "table": entity,
                "fields": self._get_entity_fields(entity),
                "relationships": self._get_entity_relationships(entity, entities)
            })
        
        return models
    
    async def _generate_auth_system(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate authentication system configuration"""
        return {
            "type": "jwt",
            "provider": requirements.get("auth_provider", "local"),
            "features": [
                "registration",
                "login",
                "logout", 
                "password_reset",
                "email_verification"
            ],
            "middleware": True,
            "refresh_tokens": True,
            "session_management": True
        }
    
    async def _generate_middleware(self, framework: str, requirements: Dict[str, Any]) -> List[Dict]:
        """Generate middleware configuration"""
        middleware = [
            {"name": "cors", "description": "Cross-Origin Resource Sharing"},
            {"name": "helmet", "description": "Security headers"},
            {"name": "compression", "description": "Response compression"},
            {"name": "rate_limit", "description": "Rate limiting"},
            {"name": "logging", "description": "Request logging"}
        ]
        
        if requirements.get("authentication", True):
            middleware.append({"name": "auth", "description": "Authentication middleware"})
        
        return middleware
    
    async def _generate_backend_tests(self, framework: str, api_endpoints: List[Dict]) -> List[Dict]:
        """Generate test files for backend"""
        tests = []
        
        for endpoint in api_endpoints:
            tests.append({
                "file": f"test_{endpoint['name']}.test.ts",
                "type": "integration",
                "description": f"Tests for {endpoint['name']} endpoint"
            })
        
        tests.extend([
            {"file": "auth.test.ts", "type": "unit", "description": "Authentication tests"},
            {"file": "database.test.ts", "type": "integration", "description": "Database tests"},
            {"file": "middleware.test.ts", "type": "unit", "description": "Middleware tests"}
        ])
        
        return tests
    
    async def _generate_backend_config(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate backend configuration"""
        return {
            "database": {
                "type": requirements.get("database_type", "postgresql"),
                "host": "localhost",
                "port": 5432,
                "migrations": True,
                "seeding": True
            },
            "cache": {
                "type": "redis",
                "host": "localhost",
                "port": 6379
            },
            "server": {
                "port": 3001,
                "cors": True,
                "rate_limiting": True
            },
            "logging": {
                "level": "info",
                "format": "json"
            }
        }
    
    def _generate_express_server_file(self) -> str:
        """Generate Express server entry point"""
        return '''import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});'''
    
    def _generate_typescript_config(self) -> str:
        """Generate TypeScript configuration"""
        return '''{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}'''
    
    def _generate_env_template(self, requirements: Dict[str, Any]) -> str:
        """Generate environment variables template"""
        return '''# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_USER=user
DATABASE_PASSWORD=password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=7d

# External APIs
OPENAI_API_KEY=sk-your-openai-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json'''
    
    def _generate_database_connection(self) -> str:
        """Generate database connection setup"""
        return '''import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'myapp',
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getClient = () => {
  return pool.connect();
};'''
    
    def _generate_auth_middleware(self) -> str:
        """Generate authentication middleware"""
        return '''import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  
  next();
};'''
    
    def _generate_fastapi_main_file(self, requirements: Dict[str, Any]) -> str:
        """Generate FastAPI main application file"""
        return '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API for " + requirements.get('name', 'Application')
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}'''
    
    def _generate_fastapi_requirements(self, requirements: Dict[str, Any]) -> str:
        """Generate FastAPI requirements.txt"""
        return '''fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
sqlalchemy==2.0.23
alembic==1.13.1
psycopg2-binary==2.9.9
redis==5.0.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
email-validator==2.1.0
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2'''
    
    def _get_entity_fields(self, entity: str) -> List[Dict]:
        """Get fields for a database entity"""
        common_fields = [
            {"name": "id", "type": "uuid", "primary": True},
            {"name": "created_at", "type": "timestamp", "default": "now()"},
            {"name": "updated_at", "type": "timestamp", "default": "now()"}
        ]
        
        if entity == "users":
            return common_fields + [
                {"name": "email", "type": "string", "unique": True, "required": True},
                {"name": "password_hash", "type": "string", "required": True},
                {"name": "first_name", "type": "string"},
                {"name": "last_name", "type": "string"},
                {"name": "is_active", "type": "boolean", "default": True}
            ]
        elif entity == "projects":
            return common_fields + [
                {"name": "name", "type": "string", "required": True},
                {"name": "description", "type": "text"},
                {"name": "owner_id", "type": "uuid", "foreign_key": "users.id"},
                {"name": "status", "type": "string", "default": "active"}
            ]
        else:
            return common_fields + [
                {"name": "name", "type": "string", "required": True},
                {"name": "description", "type": "text"}
            ]
    
    def _get_entity_relationships(self, entity: str, all_entities: List[str]) -> List[Dict]:
        """Get relationships for a database entity"""
        relationships = []
        
        if entity == "users" and "projects" in all_entities:
            relationships.append({
                "type": "has_many",
                "target": "projects",
                "foreign_key": "owner_id"
            })
        elif entity == "projects" and "users" in all_entities:
            relationships.append({
                "type": "belongs_to",
                "target": "users",
                "foreign_key": "owner_id"
            })
        
        return relationships