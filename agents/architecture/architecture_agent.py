import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
from ..llm_adapter import LLMMessage, llm_manager

class ArchitectureAgent(BaseAgent):
    """Agent responsible for system architecture design and technical decisions"""
    
    def __init__(self):
        super().__init__("architect-001", AgentType.ARCHITECTURE)
        self.capabilities = [
            "system_design",
            "database_design", 
            "api_design",
            "security_architecture",
            "scalability_design",
            "technology_selection",
            "integration_design",
            "performance_architecture"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        """Check if this agent can handle the given task"""
        architecture_tasks = [
            "design_system_architecture",
            "design_database_schema",
            "design_api_structure",
            "select_technology_stack",
            "design_security_architecture",
            "create_integration_plan",
            "design_deployment_architecture",
            "create_architecture_documentation"
        ]
        return task.type in architecture_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute architecture tasks"""
        
        if task.type == "design_system_architecture":
            return await self._design_system_architecture(task, context)
        elif task.type == "design_database_schema":
            return await self._design_database_schema(task, context)
        elif task.type == "design_api_structure":
            return await self._design_api_structure(task, context)
        elif task.type == "select_technology_stack":
            return await self._select_technology_stack(task, context)
        elif task.type == "design_security_architecture":
            return await self._design_security_architecture(task, context)
        elif task.type == "create_integration_plan":
            return await self._create_integration_plan(task, context)
        elif task.type == "design_deployment_architecture":
            return await self._design_deployment_architecture(task, context)
        elif task.type == "create_architecture_documentation":
            return await self._create_architecture_documentation(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _design_system_architecture(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design overall system architecture"""
        
        requirements = task.inputs.get("requirements", {})
        non_functional_requirements = task.inputs.get("non_functional_requirements", {})
        constraints = task.inputs.get("constraints", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior system architect designing scalable, maintainable software systems. Create a comprehensive system architecture based on the requirements.

Design considerations:
1. System patterns (microservices, monolith, serverless)
2. Component architecture and interactions
3. Data flow and storage patterns
4. Scalability and performance
5. Security and compliance
6. Deployment and operations
7. Integration patterns
8. Technology stack recommendations

Format as JSON:
{
    "architecture_overview": {
        "pattern": "microservices|monolith|serverless|hybrid",
        "description": "Overall architecture description",
        "key_principles": ["principle1", "principle2"],
        "architectural_drivers": ["driver1", "driver2"]
    },
    "system_components": [
        {
            "name": "component_name",
            "type": "service|database|queue|cache|gateway",
            "description": "component description",
            "responsibilities": ["responsibility1", "responsibility2"],
            "interfaces": [
                {
                    "type": "REST|GraphQL|gRPC|Message",
                    "protocol": "HTTP|TCP|UDP",
                    "format": "JSON|XML|Binary"
                }
            ],
            "dependencies": ["other_component"],
            "technology_recommendations": ["tech1", "tech2"]
        }
    ],
    "data_architecture": {
        "storage_pattern": "CQRS|Event Sourcing|Traditional",
        "databases": [
            {
                "name": "primary_db",
                "type": "PostgreSQL|MySQL|MongoDB|Redis",
                "purpose": "primary data storage",
                "components_using": ["component1"]
            }
        ],
        "data_flow": [
            {
                "from": "component1",
                "to": "component2", 
                "type": "synchronous|asynchronous",
                "format": "JSON|Event"
            }
        ]
    },
    "integration_architecture": {
        "api_gateway": {
            "required": true,
            "purpose": "centralized API management",
            "features": ["authentication", "rate_limiting", "monitoring"]
        },
        "message_broker": {
            "required": false,
            "type": "RabbitMQ|Apache Kafka|Redis",
            "use_cases": ["async processing", "event streaming"]
        },
        "external_integrations": [
            {
                "system": "external_system",
                "pattern": "REST API|Webhook|File Transfer",
                "security": "OAuth|API Key|mTLS"
            }
        ]
    },
    "quality_attributes": {
        "scalability": {
            "horizontal_scaling": "supported",
            "scaling_strategy": "auto-scaling based on metrics",
            "bottlenecks": ["database", "file storage"]
        },
        "performance": {
            "response_time_target": "< 200ms",
            "throughput_target": "1000 req/sec",
            "optimization_strategies": ["caching", "CDN"]
        },
        "availability": {
            "target": "99.9%",
            "strategies": ["redundancy", "health checks", "graceful degradation"]
        },
        "security": {
            "authentication": "JWT tokens",
            "authorization": "RBAC",
            "data_protection": "encryption at rest and in transit"
        }
    },
    "deployment_architecture": {
        "deployment_pattern": "containerized|serverless|traditional",
        "environments": ["development", "staging", "production"],
        "infrastructure": "cloud|on-premise|hybrid",
        "orchestration": "Kubernetes|Docker Swarm|ECS"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design system architecture for:\n\nRequirements: {json.dumps(requirements, indent=2)}\n\nNon-functional Requirements: {json.dumps(non_functional_requirements, indent=2)}\n\nConstraints: {json.dumps(constraints, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            architecture = json.loads(response.content)
            
            return {
                "system_architecture": architecture,
                "architecture_metadata": {
                    "designed_at": datetime.utcnow().isoformat(),
                    "architect": self.agent_id,
                    "version": "1.0",
                    "review_status": "draft"
                },
                "architecture_decisions": self._extract_key_decisions(architecture),
                "trade_offs": self._identify_trade_offs(architecture)
            }
        except Exception as e:
            self.logger.error(f"System architecture design failed: {e}")
            raise
    
    async def _design_database_schema(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design database schema and data model"""
        
        data_requirements = task.inputs.get("data_requirements", {})
        entities = task.inputs.get("entities", [])
        business_rules = task.inputs.get("business_rules", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a database architect designing optimal database schemas. Create a comprehensive data model and schema design.

Design considerations:
1. Entity relationships and cardinalities
2. Normalization vs denormalization
3. Indexing strategy
4. Data types and constraints
5. Performance optimization
6. Data integrity and consistency
7. Scalability considerations
8. Migration strategy

Format as JSON:
{
    "database_design": {
        "type": "relational|document|graph|key-value",
        "schema_pattern": "normalized|denormalized|hybrid",
        "design_principles": ["principle1", "principle2"]
    },
    "entities": [
        {
            "name": "entity_name",
            "description": "entity description",
            "table_name": "table_name",
            "fields": [
                {
                    "name": "field_name",
                    "type": "VARCHAR|INTEGER|TIMESTAMP|JSON",
                    "nullable": false,
                    "unique": false,
                    "default": null,
                    "constraints": ["constraint description"],
                    "index": false,
                    "description": "field purpose"
                }
            ],
            "primary_key": ["field1"],
            "indexes": [
                {
                    "name": "index_name",
                    "fields": ["field1", "field2"],
                    "type": "btree|hash|gin",
                    "unique": false
                }
            ]
        }
    ],
    "relationships": [
        {
            "name": "relationship_name",
            "type": "one-to-one|one-to-many|many-to-many",
            "from_entity": "entity1",
            "to_entity": "entity2",
            "foreign_key": "field_name",
            "cascade_delete": false,
            "description": "relationship description"
        }
    ],
    "views": [
        {
            "name": "view_name",
            "description": "view purpose",
            "query": "SELECT statement",
            "materialized": false
        }
    ],
    "stored_procedures": [
        {
            "name": "procedure_name",
            "purpose": "procedure purpose",
            "parameters": ["param1", "param2"],
            "returns": "return type"
        }
    ],
    "data_migration": {
        "migration_strategy": "big bang|phased|parallel run",
        "migration_scripts": ["script1", "script2"],
        "rollback_plan": "rollback strategy"
    },
    "performance_optimization": {
        "partitioning": "none|horizontal|vertical",
        "archiving_strategy": "time-based archiving after 2 years",
        "caching_strategy": "Redis for frequently accessed data",
        "read_replicas": "required for scaling reads"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design database schema for:\n\nData Requirements: {json.dumps(data_requirements, indent=2)}\n\nEntities: {json.dumps(entities, indent=2)}\n\nBusiness Rules: {json.dumps(business_rules, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            database_design = json.loads(response.content)
            
            # Generate SQL migration scripts
            migration_scripts = self._generate_migration_scripts(database_design)
            
            return {
                "database_design": database_design,
                "migration_scripts": migration_scripts,
                "design_metadata": {
                    "designed_at": datetime.utcnow().isoformat(),
                    "designer": self.agent_id,
                    "schema_version": "1.0"
                }
            }
        except Exception as e:
            self.logger.error(f"Database schema design failed: {e}")
            raise
    
    async def _design_api_structure(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design API structure and endpoints"""
        
        functional_requirements = task.inputs.get("functional_requirements", [])
        user_stories = task.inputs.get("user_stories", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an API architect designing RESTful APIs. Create a comprehensive API design with endpoints, schemas, and documentation.

Design principles:
1. RESTful design patterns
2. Resource-oriented URLs
3. HTTP methods and status codes
4. Request/response schemas
5. Error handling
6. Authentication and authorization
7. Rate limiting and pagination
8. Versioning strategy

Format as JSON:
{
    "api_design": {
        "base_url": "/api/v1",
        "authentication": "JWT|OAuth2|API Key",
        "versioning_strategy": "URL path|Header|Query parameter",
        "content_type": "application/json",
        "rate_limiting": "100 requests per minute per user"
    },
    "endpoints": [
        {
            "path": "/users",
            "method": "GET",
            "summary": "List users",
            "description": "Retrieve a paginated list of users",
            "parameters": [
                {
                    "name": "page",
                    "type": "query",
                    "data_type": "integer",
                    "required": false,
                    "default": 1,
                    "description": "Page number"
                }
            ],
            "request_schema": null,
            "response_schema": {
                "type": "object",
                "properties": {
                    "users": {"type": "array", "items": {"$ref": "#/components/schemas/User"}},
                    "pagination": {"$ref": "#/components/schemas/Pagination"}
                }
            },
            "responses": {
                "200": "Success",
                "400": "Bad Request",
                "401": "Unauthorized",
                "500": "Internal Server Error"
            },
            "authentication_required": true,
            "rate_limit": "standard"
        }
    ],
    "schemas": [
        {
            "name": "User",
            "type": "object",
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "email": {"type": "string", "format": "email"},
                "created_at": {"type": "string", "format": "date-time"}
            },
            "required": ["id", "email"]
        }
    ],
    "error_handling": {
        "error_format": {
            "error": {"type": "string"},
            "message": {"type": "string"},
            "details": {"type": "object"}
        },
        "error_codes": [
            {"code": "VALIDATION_ERROR", "description": "Request validation failed"},
            {"code": "RESOURCE_NOT_FOUND", "description": "Requested resource not found"}
        ]
    },
    "security": {
        "authentication_flow": "OAuth2 Authorization Code",
        "authorization_model": "Role-based access control",
        "data_protection": "All sensitive data encrypted"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design API structure for:\n\nFunctional Requirements: {json.dumps(functional_requirements, indent=2)}\n\nUser Stories: {json.dumps(user_stories, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            api_design = json.loads(response.content)
            
            # Generate OpenAPI specification
            openapi_spec = self._generate_openapi_spec(api_design)
            
            return {
                "api_design": api_design,
                "openapi_specification": openapi_spec,
                "api_metadata": {
                    "designed_at": datetime.utcnow().isoformat(),
                    "designer": self.agent_id,
                    "api_version": "1.0"
                }
            }
        except Exception as e:
            self.logger.error(f"API structure design failed: {e}")
            raise
    
    async def _select_technology_stack(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Select appropriate technology stack"""
        
        requirements = task.inputs.get("requirements", {})
        constraints = task.inputs.get("constraints", [])
        team_skills = task.inputs.get("team_skills", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a technology architect selecting the optimal technology stack. Consider requirements, constraints, team skills, and industry best practices.

Evaluation criteria:
1. Technical fit for requirements
2. Team expertise and learning curve
3. Community support and maturity
4. Performance characteristics
5. Scalability potential
6. Long-term maintenance
7. Cost considerations
8. Integration capabilities

Format as JSON:
{
    "technology_stack": {
        "frontend": {
            "framework": "React|Vue|Angular|Svelte",
            "language": "TypeScript|JavaScript",
            "ui_library": "Material-UI|Ant Design|Tailwind CSS",
            "state_management": "Redux|Vuex|NgRx|Context API",
            "build_tool": "Vite|Webpack|Parcel",
            "testing": "Jest|Vitest|Cypress",
            "justification": "Why this choice was made"
        },
        "backend": {
            "framework": "Node.js|Python|Java|Go|.NET",
            "web_framework": "Express|FastAPI|Spring|Gin|ASP.NET",
            "database": "PostgreSQL|MySQL|MongoDB|Redis",
            "orm": "TypeORM|Prisma|SQLAlchemy|Hibernate",
            "authentication": "JWT|OAuth2|Passport",
            "testing": "Jest|pytest|JUnit|Testify",
            "justification": "Why this choice was made"
        },
        "infrastructure": {
            "cloud_provider": "AWS|GCP|Azure|DigitalOcean",
            "container_platform": "Docker|Kubernetes|Docker Swarm",
            "ci_cd": "GitHub Actions|GitLab CI|Jenkins|CircleCI",
            "monitoring": "Prometheus|DataDog|New Relic",
            "logging": "ELK Stack|Fluentd|CloudWatch",
            "justification": "Why this choice was made"
        },
        "development_tools": {
            "version_control": "Git",
            "code_editor": "VS Code|IntelliJ|Vim",
            "api_documentation": "Swagger|Postman|Insomnia",
            "project_management": "Jira|GitHub Issues|Linear"
        }
    },
    "decision_matrix": [
        {
            "category": "Frontend Framework",
            "options": [
                {
                    "name": "React",
                    "score": 9,
                    "pros": ["Large ecosystem", "Team expertise"],
                    "cons": ["Learning curve for beginners"]
                }
            ],
            "selected": "React",
            "rationale": "Best fit for team skills and requirements"
        }
    ],
    "implementation_plan": {
        "development_phases": [
            {
                "phase": "Setup",
                "duration": "1 week",
                "activities": ["Environment setup", "Tooling configuration"]
            }
        ],
        "learning_requirements": [
            {
                "technology": "TypeScript",
                "team_members": 2,
                "training_needed": "1 week"
            }
        ],
        "risk_mitigation": [
            {
                "risk": "Team unfamiliarity with technology",
                "mitigation": "Provide training and pair programming"
            }
        ]
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Select technology stack for:\n\nRequirements: {json.dumps(requirements, indent=2)}\n\nConstraints: {json.dumps(constraints, indent=2)}\n\nTeam Skills: {json.dumps(team_skills, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            tech_stack = json.loads(response.content)
            
            return {
                "technology_stack": tech_stack,
                "selection_metadata": {
                    "selected_at": datetime.utcnow().isoformat(),
                    "selector": self.agent_id,
                    "evaluation_method": "weighted_scoring"
                }
            }
        except Exception as e:
            self.logger.error(f"Technology stack selection failed: {e}")
            raise
    
    async def _design_security_architecture(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design security architecture and measures"""
        
        security_requirements = task.inputs.get("security_requirements", {})
        compliance_requirements = task.inputs.get("compliance_requirements", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a security architect designing comprehensive security measures. Create a security architecture that addresses all security concerns.

Security domains:
1. Authentication and authorization
2. Data protection and encryption
3. Network security
4. Application security
5. Infrastructure security
6. Compliance and governance
7. Incident response
8. Security monitoring

Format as JSON with detailed security architecture."""
            ),
            LLMMessage(
                role="user",
                content=f"Design security architecture for:\n\nSecurity Requirements: {json.dumps(security_requirements, indent=2)}\n\nCompliance: {json.dumps(compliance_requirements, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            security_architecture = json.loads(response.content)
            
            return {
                "security_architecture": security_architecture,
                "security_metadata": {
                    "designed_at": datetime.utcnow().isoformat(),
                    "designer": self.agent_id,
                    "compliance_level": "high"
                }
            }
        except Exception as e:
            self.logger.error(f"Security architecture design failed: {e}")
            raise
    
    async def _create_integration_plan(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create integration plan for external systems"""
        
        external_systems = task.inputs.get("external_systems", [])
        integration_requirements = task.inputs.get("integration_requirements", {})
        
        # Create comprehensive integration plan
        integration_plan = self._design_integration_architecture(external_systems, integration_requirements)
        
        return {
            "integration_plan": integration_plan,
            "integration_metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "creator": self.agent_id
            }
        }
    
    async def _design_deployment_architecture(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design deployment and infrastructure architecture"""
        
        deployment_requirements = task.inputs.get("deployment_requirements", {})
        scalability_requirements = task.inputs.get("scalability_requirements", {})
        
        # Design deployment architecture
        deployment_architecture = self._create_deployment_design(deployment_requirements, scalability_requirements)
        
        return {
            "deployment_architecture": deployment_architecture,
            "deployment_metadata": {
                "designed_at": datetime.utcnow().isoformat(),
                "designer": self.agent_id
            }
        }
    
    async def _create_architecture_documentation(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create comprehensive architecture documentation"""
        
        architecture_components = task.inputs.get("architecture_components", {})
        
        # Generate documentation
        documentation = self._generate_architecture_docs(architecture_components)
        
        return {
            "documentation": documentation,
            "documentation_metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "creator": self.agent_id,
                "format": "markdown"
            }
        }
    
    def _extract_key_decisions(self, architecture: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract key architectural decisions"""
        decisions = []
        
        # Extract pattern decision
        pattern = architecture.get("architecture_overview", {}).get("pattern")
        if pattern:
            decisions.append({
                "decision": f"Architectural Pattern: {pattern}",
                "rationale": "Based on scalability and team structure requirements",
                "alternatives": ["microservices", "monolith", "serverless"],
                "implications": ["Development complexity", "Deployment strategy", "Team organization"]
            })
        
        return decisions
    
    def _identify_trade_offs(self, architecture: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify architectural trade-offs"""
        trade_offs = []
        
        # Example trade-offs based on architectural choices
        pattern = architecture.get("architecture_overview", {}).get("pattern")
        if pattern == "microservices":
            trade_offs.append({
                "aspect": "Development Complexity",
                "trade_off": "Higher development complexity for better scalability",
                "benefits": ["Independent scaling", "Technology diversity", "Team autonomy"],
                "costs": ["Service coordination", "Network latency", "Operational complexity"]
            })
        
        return trade_offs
    
    def _generate_migration_scripts(self, database_design: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate SQL migration scripts"""
        scripts = []
        
        entities = database_design.get("entities", [])
        for entity in entities:
            # Generate CREATE TABLE script
            table_name = entity.get("table_name", entity.get("name"))
            fields = entity.get("fields", [])
            
            create_script = f"CREATE TABLE {table_name} (\n"
            field_definitions = []
            
            for field in fields:
                field_def = f"  {field['name']} {field['type']}"
                if not field.get("nullable", True):
                    field_def += " NOT NULL"
                if field.get("unique", False):
                    field_def += " UNIQUE"
                if field.get("default") is not None:
                    field_def += f" DEFAULT {field['default']}"
                field_definitions.append(field_def)
            
            # Add primary key
            primary_key = entity.get("primary_key", [])
            if primary_key:
                field_definitions.append(f"  PRIMARY KEY ({', '.join(primary_key)})")
            
            create_script += ",\n".join(field_definitions) + "\n);"
            
            scripts.append({
                "name": f"create_{table_name}_table",
                "type": "CREATE TABLE",
                "script": create_script
            })
        
        return scripts
    
    def _generate_openapi_spec(self, api_design: Dict[str, Any]) -> Dict[str, Any]:
        """Generate OpenAPI 3.0 specification"""
        
        spec = {
            "openapi": "3.0.0",
            "info": {
                "title": "API Specification",
                "version": "1.0.0",
                "description": "Generated API specification"
            },
            "servers": [
                {
                    "url": api_design.get("api_design", {}).get("base_url", "/api/v1"),
                    "description": "Development server"
                }
            ],
            "paths": {},
            "components": {
                "schemas": {},
                "securitySchemes": {
                    "bearerAuth": {
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT"
                    }
                }
            }
        }
        
        # Add endpoints to paths
        endpoints = api_design.get("endpoints", [])
        for endpoint in endpoints:
            path = endpoint.get("path", "")
            method = endpoint.get("method", "GET").lower()
            
            if path not in spec["paths"]:
                spec["paths"][path] = {}
            
            spec["paths"][path][method] = {
                "summary": endpoint.get("summary", ""),
                "description": endpoint.get("description", ""),
                "responses": {
                    str(code): {"description": desc} 
                    for code, desc in endpoint.get("responses", {}).items()
                }
            }
            
            if endpoint.get("authentication_required", False):
                spec["paths"][path][method]["security"] = [{"bearerAuth": []}]
        
        # Add schemas
        schemas = api_design.get("schemas", [])
        for schema in schemas:
            spec["components"]["schemas"][schema["name"]] = {
                "type": schema.get("type", "object"),
                "properties": schema.get("properties", {}),
                "required": schema.get("required", [])
            }
        
        return spec
    
    def _design_integration_architecture(self, external_systems: List, integration_requirements: Dict) -> Dict:
        """Design integration architecture"""
        return {
            "integration_patterns": ["API Gateway", "Message Queue", "Event Streaming"],
            "external_systems": external_systems,
            "integration_points": [],
            "data_synchronization": "event-driven",
            "error_handling": "retry with exponential backoff"
        }
    
    def _create_deployment_design(self, deployment_requirements: Dict, scalability_requirements: Dict) -> Dict:
        """Create deployment architecture design"""
        return {
            "deployment_model": "containerized",
            "orchestration": "Kubernetes",
            "scaling_strategy": "horizontal auto-scaling",
            "environments": ["development", "staging", "production"],
            "infrastructure": "cloud-native"
        }
    
    def _generate_architecture_docs(self, architecture_components: Dict) -> Dict:
        """Generate architecture documentation"""
        return {
            "overview": "System architecture overview",
            "components": "Detailed component descriptions",
            "deployment": "Deployment architecture guide",
            "security": "Security architecture documentation",
            "integration": "Integration patterns and guidelines"
        }