"""
Tests for backend agent functionality
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from agents.backend.backend_agent import BackendAgent
from agents.base_agent import Task, TaskPriority, AgentExecutionContext


class TestBackendAgent:
    """Test BackendAgent functionality"""
    
    @pytest.fixture
    def backend_agent(self):
        return BackendAgent()
    
    @pytest.fixture
    def sample_context(self):
        return AgentExecutionContext(
            project_id="test-backend-project",
            user_id="test-user",
            requirements={
                "entities": ["users", "projects"],
                "authentication": True,
                "database": True,
                "real_time": False,
                "ai_integration": False
            },
            project_type="full_stack_web_app",
            tech_stack=["typescript", "express", "postgresql"],
            configuration={"debug": True},
            workspace_path="/tmp/test-backend"
        )
    
    @pytest.fixture
    def develop_backend_task(self):
        return Task(
            id="develop-backend-001",
            type="develop_backend",
            description="Develop complete backend system",
            priority=TaskPriority.HIGH,
            inputs={
                "architecture": {
                    "pattern": "layered",
                    "database": "postgresql"
                },
                "requirements": {
                    "api_endpoints": 10,
                    "authentication": True,
                    "database_models": 3
                }
            }
        )
    
    def test_backend_agent_initialization(self, backend_agent):
        """Test backend agent initialization"""
        assert backend_agent.agent_id == "backend-001"
        assert backend_agent.agent_type.value == "backend_developer"
        
        expected_capabilities = [
            "api_development",
            "database_design", 
            "server_implementation",
            "authentication_setup",
            "api_documentation",
            "testing_framework",
            "security_implementation"
        ]
        
        for capability in expected_capabilities:
            assert capability in backend_agent.capabilities
        
        expected_frameworks = [
            "express", "fastapi", "django", "spring", "rails", "encore"
        ]
        
        for framework in expected_frameworks:
            assert framework in backend_agent.supported_frameworks
    
    def test_can_handle_task(self, backend_agent):
        """Test task handling capability"""
        # Supported tasks
        supported_tasks = [
            "develop_backend", "create_api", "setup_database",
            "implement_auth", "create_routes", "setup_middleware",
            "generate_api_docs", "setup_testing"
        ]
        
        for task_type in supported_tasks:
            task = Task(
                id=f"test-{task_type}",
                type=task_type,
                description=f"Test {task_type}",
                priority=TaskPriority.MEDIUM
            )
            assert backend_agent.can_handle_task(task) is True
        
        # Unsupported task
        unsupported_task = Task(
            id="unsupported",
            type="frontend_development",
            description="Frontend task",
            priority=TaskPriority.LOW
        )
        assert backend_agent.can_handle_task(unsupported_task) is False
    
    def test_select_backend_framework(self, backend_agent):
        """Test backend framework selection logic"""
        # Test with preferred framework
        tech_stack = {"backend_framework": "express"}
        requirements = {}
        framework = backend_agent._select_backend_framework(tech_stack, requirements)
        assert framework == "express"
        
        # Test with real-time requirements
        tech_stack = {}
        requirements = {"real_time": True}
        framework = backend_agent._select_backend_framework(tech_stack, requirements)
        assert framework == "express"
        
        # Test with AI integration
        requirements = {"ai_integration": True}
        framework = backend_agent._select_backend_framework(tech_stack, requirements)
        assert framework == "fastapi"
        
        # Test with enterprise requirements
        requirements = {"enterprise": True}
        framework = backend_agent._select_backend_framework(tech_stack, requirements)
        assert framework == "spring"
        
        # Test default
        requirements = {}
        framework = backend_agent._select_backend_framework(tech_stack, requirements)
        assert framework == "express"
    
    def test_generate_express_package_json(self, backend_agent):
        """Test Express package.json generation"""
        requirements = {
            "name": "test-api",
            "description": "Test API",
            "database": True,
            "authentication": True,
            "validation": True
        }
        
        package_json_str = backend_agent._generate_express_package_json(requirements)
        package_json = json.loads(package_json_str)
        
        # Check basic structure
        assert package_json["name"] == "test-api"
        assert package_json["description"] == "Test API"
        assert package_json["version"] == "1.0.0"
        
        # Check scripts
        required_scripts = ["start", "dev", "build", "test", "lint"]
        for script in required_scripts:
            assert script in package_json["scripts"]
        
        # Check dependencies
        required_deps = ["express", "typescript", "cors", "helmet", "dotenv"]
        for dep in required_deps:
            assert dep in package_json["dependencies"]
        
        # Check database dependencies
        assert "pg" in package_json["dependencies"]
        assert "typeorm" in package_json["dependencies"]
        
        # Check auth dependencies
        assert "jsonwebtoken" in package_json["dependencies"]
        assert "bcryptjs" in package_json["dependencies"]
        
        # Check validation dependencies
        assert "joi" in package_json["dependencies"]
        
        # Check dev dependencies
        required_dev_deps = ["@types/node", "jest", "eslint"]
        for dep in required_dev_deps:
            assert dep in package_json["devDependencies"]
    
    def test_generate_express_app_file(self, backend_agent):
        """Test Express app file generation"""
        requirements = {}
        app_content = backend_agent._generate_express_app_file(requirements)
        
        # Check for essential imports
        assert "import express from 'express'" in app_content
        assert "import cors from 'cors'" in app_content
        assert "import helmet from 'helmet'" in app_content
        
        # Check for middleware setup
        assert "app.use(helmet())" in app_content
        assert "app.use(cors())" in app_content
        assert "app.use(express.json(" in app_content
        
        # Check for health endpoint
        assert "app.get('/health'" in app_content
        assert "status: 'OK'" in app_content
        
        # Check for error handling
        assert "Error, req: express.Request, res: express.Response" in app_content
        assert "res.status(500)" in app_content
        
        # Check for 404 handler
        assert "app.use('*'" in app_content
        assert "res.status(404)" in app_content
    
    @pytest.mark.asyncio
    async def test_generate_express_structure(self, backend_agent):
        """Test Express project structure generation"""
        requirements = {
            "database": True,
            "authentication": True
        }
        
        structure = await backend_agent._generate_express_structure(requirements)
        
        # Check directories
        expected_dirs = [
            "src/", "src/controllers/", "src/models/", "src/routes/",
            "src/middleware/", "src/services/", "src/utils/", "src/config/",
            "tests/", "tests/unit/", "tests/integration/"
        ]
        
        for expected_dir in expected_dirs:
            assert expected_dir in structure["directories"]
        
        # Check files
        file_paths = [f["path"] for f in structure["files"]]
        expected_files = [
            "package.json", "src/app.ts", "src/server.ts", 
            "tsconfig.json", ".env.example"
        ]
        
        for expected_file in expected_files:
            assert expected_file in file_paths
        
        # Check conditional files
        assert "src/database.ts" in file_paths  # database=True
        assert "src/middleware/auth.ts" in file_paths  # authentication=True
    
    @pytest.mark.asyncio
    async def test_generate_encore_structure(self, backend_agent):
        """Test Encore.ts project structure generation"""
        requirements = {
            "services": ["users", "projects", "auth"]
        }
        
        structure = await backend_agent._generate_encore_structure(requirements)
        
        # Check directories
        expected_dirs = [
            "backend/",
            "backend/users/",
            "backend/projects/", 
            "backend/auth/"
        ]
        
        for expected_dir in expected_dirs:
            assert expected_dir in structure["directories"]
        
        # Check service files
        file_paths = [f["path"] for f in structure["files"]]
        
        for service in ["users", "projects", "auth"]:
            assert f"backend/{service}/encore.service.ts" in file_paths
            assert f"backend/{service}/types.ts" in file_paths
    
    def test_get_service_endpoints(self, backend_agent):
        """Test service endpoint generation"""
        # Test users service
        user_endpoints = backend_agent._get_service_endpoints("users", {})
        expected_user_endpoints = ["create", "get", "list", "update", "delete"]
        
        endpoint_names = [ep["name"] for ep in user_endpoints]
        for expected in expected_user_endpoints:
            assert expected in endpoint_names
        
        # Test projects service
        project_endpoints = backend_agent._get_service_endpoints("projects", {})
        expected_project_endpoints = ["create", "get", "list", "update", "delete"]
        
        endpoint_names = [ep["name"] for ep in project_endpoints]
        for expected in expected_project_endpoints:
            assert expected in endpoint_names
        
        # Test unknown service
        unknown_endpoints = backend_agent._get_service_endpoints("unknown", {})
        assert len(unknown_endpoints) == 1
        assert unknown_endpoints[0]["name"] == "main"
    
    def test_generate_encore_endpoint(self, backend_agent):
        """Test Encore endpoint generation"""
        endpoint = {"name": "create", "description": "Create user"}
        service = "users"
        
        endpoint_content = backend_agent._generate_encore_endpoint(endpoint, service)
        
        # Check imports
        assert 'import { api } from "encore.dev/api"' in endpoint_content
        
        # Check interfaces
        assert "interface CreateRequest" in endpoint_content
        assert "interface CreateResponse" in endpoint_content
        
        # Check API definition
        assert "export const create = api" in endpoint_content
        assert '"POST"' in endpoint_content
        assert '"/users/create"' in endpoint_content
        assert '"expose": true' in endpoint_content
    
    def test_generate_typescript_config(self, backend_agent):
        """Test TypeScript configuration generation"""
        config_content = backend_agent._generate_typescript_config()
        config = json.loads(config_content)
        
        # Check compiler options
        assert config["compilerOptions"]["target"] == "ES2020"
        assert config["compilerOptions"]["module"] == "commonjs"
        assert config["compilerOptions"]["strict"] is True
        assert config["compilerOptions"]["esModuleInterop"] is True
        
        # Check paths
        assert config["compilerOptions"]["outDir"] == "./dist"
        assert config["compilerOptions"]["rootDir"] == "./src"
        
        # Check includes/excludes
        assert "src/**/*" in config["include"]
        assert "node_modules" in config["exclude"]
        assert "dist" in config["exclude"]
    
    def test_generate_env_template(self, backend_agent):
        """Test environment template generation"""
        requirements = {}
        env_content = backend_agent._generate_env_template(requirements)
        
        # Check sections
        assert "# Server Configuration" in env_content
        assert "# Database Configuration" in env_content
        assert "# Authentication" in env_content
        assert "# External APIs" in env_content
        
        # Check specific variables
        assert "NODE_ENV=development" in env_content
        assert "PORT=3001" in env_content
        assert "DATABASE_URL=" in env_content
        assert "JWT_SECRET=" in env_content
        assert "OPENAI_API_KEY=" in env_content
    
    def test_generate_database_connection(self, backend_agent):
        """Test database connection generation"""
        db_content = backend_agent._generate_database_connection()
        
        # Check imports
        assert "import { Pool } from 'pg'" in db_content
        assert "import dotenv from 'dotenv'" in db_content
        
        # Check pool configuration
        assert "new Pool({" in db_content
        assert "process.env.DATABASE_HOST" in db_content
        assert "process.env.DATABASE_PORT" in db_content
        
        # Check exports
        assert "export default pool" in db_content
        assert "export const query" in db_content
        assert "export const getClient" in db_content
        
        # Check error handling
        assert "pool.on('error'" in db_content
    
    def test_generate_auth_middleware(self, backend_agent):
        """Test authentication middleware generation"""
        auth_content = backend_agent._generate_auth_middleware()
        
        # Check imports
        assert "import jwt from 'jsonwebtoken'" in auth_content
        assert "Request, Response, NextFunction" in auth_content
        
        # Check interface
        assert "interface AuthRequest extends Request" in auth_content
        
        # Check functions
        assert "export const authenticateToken" in auth_content
        assert "export const optionalAuth" in auth_content
        
        # Check JWT verification
        assert "jwt.verify(token, process.env.JWT_SECRET!" in auth_content
        assert "res.status(401)" in auth_content
        assert "res.status(403)" in auth_content
    
    @pytest.mark.asyncio
    async def test_generate_api_endpoints(self, backend_agent):
        """Test API endpoint generation"""
        requirements = {"entities": ["users", "projects"]}
        framework = "express"
        
        endpoints = await backend_agent._generate_api_endpoints(requirements, framework)
        
        # Check endpoint count (5 per entity)
        assert len(endpoints) == 10
        
        # Check users endpoints
        user_endpoints = [ep for ep in endpoints if "users" in ep["path"]]
        assert len(user_endpoints) == 5
        
        methods = [ep["method"] for ep in user_endpoints]
        assert "GET" in methods
        assert "POST" in methods
        assert "PUT" in methods
        assert "DELETE" in methods
        
        # Check projects endpoints
        project_endpoints = [ep for ep in endpoints if "projects" in ep["path"]]
        assert len(project_endpoints) == 5
    
    @pytest.mark.asyncio
    async def test_generate_database_models(self, backend_agent):
        """Test database model generation"""
        requirements = {"entities": ["users", "projects"]}
        
        models = await backend_agent._generate_database_models(requirements)
        
        assert len(models) == 2
        
        # Check users model
        users_model = next(m for m in models if m["name"] == "Users")
        assert users_model["table"] == "users"
        assert len(users_model["fields"]) > 3  # Should have common + specific fields
        
        # Check for common fields
        field_names = [f["name"] for f in users_model["fields"]]
        assert "id" in field_names
        assert "created_at" in field_names
        assert "updated_at" in field_names
        
        # Check for user-specific fields
        assert "email" in field_names
        assert "password_hash" in field_names
    
    def test_get_entity_fields(self, backend_agent):
        """Test entity field generation"""
        # Test users entity
        user_fields = backend_agent._get_entity_fields("users")
        field_names = [f["name"] for f in user_fields]
        
        # Common fields
        assert "id" in field_names
        assert "created_at" in field_names
        assert "updated_at" in field_names
        
        # User-specific fields
        assert "email" in field_names
        assert "password_hash" in field_names
        assert "first_name" in field_names
        assert "is_active" in field_names
        
        # Test projects entity
        project_fields = backend_agent._get_entity_fields("projects")
        field_names = [f["name"] for f in project_fields]
        
        assert "name" in field_names
        assert "description" in field_names
        assert "owner_id" in field_names
        assert "status" in field_names
    
    def test_get_entity_relationships(self, backend_agent):
        """Test entity relationship generation"""
        entities = ["users", "projects"]
        
        # Test users relationships
        user_rels = backend_agent._get_entity_relationships("users", entities)
        assert len(user_rels) == 1
        assert user_rels[0]["type"] == "has_many"
        assert user_rels[0]["target"] == "projects"
        
        # Test projects relationships
        project_rels = backend_agent._get_entity_relationships("projects", entities)
        assert len(project_rels) == 1
        assert project_rels[0]["type"] == "belongs_to"
        assert project_rels[0]["target"] == "users"
    
    @pytest.mark.asyncio
    async def test_generate_auth_system(self, backend_agent):
        """Test authentication system generation"""
        framework = "express"
        requirements = {"auth_provider": "oauth"}
        
        auth_system = await backend_agent._generate_auth_system(framework, requirements)
        
        assert auth_system["type"] == "jwt"
        assert auth_system["provider"] == "oauth"
        assert auth_system["middleware"] is True
        assert auth_system["refresh_tokens"] is True
        
        expected_features = [
            "registration", "login", "logout", 
            "password_reset", "email_verification"
        ]
        
        for feature in expected_features:
            assert feature in auth_system["features"]
    
    @pytest.mark.asyncio
    async def test_generate_middleware(self, backend_agent):
        """Test middleware generation"""
        framework = "express"
        requirements = {"authentication": True}
        
        middleware = await backend_agent._generate_middleware(framework, requirements)
        
        middleware_names = [m["name"] for m in middleware]
        expected_middleware = [
            "cors", "helmet", "compression", "rate_limit", "logging", "auth"
        ]
        
        for expected in expected_middleware:
            assert expected in middleware_names
    
    @pytest.mark.asyncio
    async def test_generate_backend_tests(self, backend_agent):
        """Test backend test generation"""
        framework = "express"
        api_endpoints = [
            {"name": "get_users"},
            {"name": "create_user"},
            {"name": "update_user"}
        ]
        
        tests = await backend_agent._generate_backend_tests(framework, api_endpoints)
        
        # Check endpoint tests
        test_files = [t["file"] for t in tests]
        assert "test_get_users.test.ts" in test_files
        assert "test_create_user.test.ts" in test_files
        assert "test_update_user.test.ts" in test_files
        
        # Check general tests
        assert "auth.test.ts" in test_files
        assert "database.test.ts" in test_files
        assert "middleware.test.ts" in test_files
    
    @pytest.mark.asyncio
    async def test_generate_backend_config(self, backend_agent):
        """Test backend configuration generation"""
        framework = "express"
        requirements = {"database_type": "mysql"}
        
        config = await backend_agent._generate_backend_config(framework, requirements)
        
        # Check database config
        assert config["database"]["type"] == "mysql"
        assert config["database"]["port"] == 5432
        assert config["database"]["migrations"] is True
        
        # Check other configs
        assert "cache" in config
        assert "server" in config
        assert "logging" in config
        
        assert config["server"]["port"] == 3001
        assert config["cache"]["type"] == "redis"
    
    @pytest.mark.asyncio
    async def test_calculate_backend_quality_score(self, backend_agent):
        """Test backend quality score calculation"""
        # Test with good coverage
        api_endpoints = [{"name": f"endpoint_{i}"} for i in range(8)]
        database_models = [{"name": f"model_{i}"} for i in range(5)]
        tests = [{"file": f"test_{i}.test.ts"} for i in range(6)]
        
        score = await backend_agent._calculate_backend_quality_score(
            api_endpoints, database_models, tests
        )
        
        assert score > 0
        assert score <= 100
        
        # Test with no items
        empty_score = await backend_agent._calculate_backend_quality_score([], [], [])
        assert empty_score == 0.0
        
        # Test with maximum items
        many_endpoints = [{"name": f"endpoint_{i}"} for i in range(20)]
        many_models = [{"name": f"model_{i}"} for i in range(10)]
        many_tests = [{"file": f"test_{i}.test.ts"} for i in range(10)]
        
        max_score = await backend_agent._calculate_backend_quality_score(
            many_endpoints, many_models, many_tests
        )
        
        assert max_score == 100.0
    
    @pytest.mark.asyncio
    async def test_develop_complete_backend_execution(self, backend_agent, develop_backend_task, sample_context):
        """Test complete backend development execution"""
        result = await backend_agent.execute_task(develop_backend_task, sample_context)
        
        # Check result structure
        required_keys = [
            "framework", "structure", "api_endpoints", "database_models",
            "authentication", "middleware", "tests", "configuration",
            "files_generated", "quality_score"
        ]
        
        for key in required_keys:
            assert key in result
        
        # Check framework selection
        assert result["framework"] in backend_agent.supported_frameworks
        
        # Check structure
        assert "directories" in result["structure"]
        assert "files" in result["structure"]
        assert len(result["structure"]["files"]) > 0
        
        # Check quality score
        assert 0 <= result["quality_score"] <= 100
        
        # Check files generated count
        assert result["files_generated"] > 0
    
    @pytest.mark.asyncio
    async def test_unknown_task_type(self, backend_agent, sample_context):
        """Test handling of unknown task types"""
        unknown_task = Task(
            id="unknown-task",
            type="unknown_task_type",
            description="Unknown task",
            priority=TaskPriority.MEDIUM
        )
        
        with pytest.raises(ValueError) as exc_info:
            await backend_agent.execute_task(unknown_task, sample_context)
        
        assert "Unknown task type: unknown_task_type" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_generate_fastapi_structure(self, backend_agent):
        """Test FastAPI structure generation"""
        requirements = {"name": "test-api"}
        
        structure = await backend_agent._generate_fastapi_structure(requirements)
        
        # Check directories
        expected_dirs = [
            "app/", "app/api/", "app/api/v1/", "app/api/v1/endpoints/",
            "app/core/", "app/models/", "app/schemas/", "app/services/",
            "app/db/", "tests/"
        ]
        
        for expected_dir in expected_dirs:
            assert expected_dir in structure["directories"]
        
        # Check files
        file_paths = [f["path"] for f in structure["files"]]
        assert "main.py" in file_paths
        assert "requirements.txt" in file_paths
    
    def test_generate_fastapi_main_file(self, backend_agent):
        """Test FastAPI main file generation"""
        requirements = {"name": "Test API"}
        
        main_content = backend_agent._generate_fastapi_main_file(requirements)
        
        # Check imports
        assert "from fastapi import FastAPI" in main_content
        assert "from fastapi.middleware.cors import CORSMiddleware" in main_content
        
        # Check app setup
        assert "app = FastAPI(" in main_content
        assert "title=settings.PROJECT_NAME" in main_content
        
        # Check middleware
        assert "app.add_middleware(" in main_content
        assert "CORSMiddleware" in main_content
        
        # Check health endpoint
        assert "@app.get(\"/health\")" in main_content
    
    def test_generate_fastapi_requirements(self, backend_agent):
        """Test FastAPI requirements generation"""
        requirements = {}
        
        reqs_content = backend_agent._generate_fastapi_requirements(requirements)
        
        # Check essential packages
        assert "fastapi==" in reqs_content
        assert "uvicorn" in reqs_content
        assert "pydantic==" in reqs_content
        assert "sqlalchemy==" in reqs_content
        assert "pytest==" in reqs_content
    
    @pytest.mark.asyncio
    async def test_generic_structure_fallback(self, backend_agent):
        """Test generic structure generation for unknown frameworks"""
        requirements = {"name": "Unknown Framework Project"}
        
        structure = await backend_agent._generate_generic_structure("unknown_framework", requirements)
        
        # Check basic directories
        expected_dirs = ["src/", "tests/", "docs/", "config/"]
        for expected_dir in expected_dirs:
            assert expected_dir in structure["directories"]
        
        # Check README file
        file_paths = [f["path"] for f in structure["files"]]
        assert "README.md" in file_paths