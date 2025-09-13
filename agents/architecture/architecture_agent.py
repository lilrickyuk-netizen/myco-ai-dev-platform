import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext, AgentStatus
from ..llm_adapter import LLMMessage, llm_manager
from ..config import config

class ArchitectureAgent(BaseAgent):
    def __init__(self):
        super().__init__("architecture-001", AgentType.ARCHITECTURE)
        self.capabilities = [
            "system_design",
            "architecture_patterns",
            "database_design",
            "api_design",
            "microservices_design",
            "security_architecture",
            "performance_architecture",
            "scalability_design"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        return task.type in [
            "design_system_architecture",
            "design_database",
            "design_api",
            "design_microservices",
            "design_security_architecture",
            "design_data_flow",
            "create_architecture_decision_records"
        ]
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute architecture design tasks"""
        self.logger.info(f"Executing architecture task: {task.type}")
        
        if task.type == "design_system_architecture":
            return await self._design_system_architecture(task, context)
        elif task.type == "design_database":
            return await self._design_database(task, context)
        elif task.type == "design_api":
            return await self._design_api(task, context)
        elif task.type == "design_microservices":
            return await self._design_microservices(task, context)
        elif task.type == "design_security_architecture":
            return await self._design_security_architecture(task, context)
        elif task.type == "design_data_flow":
            return await self._design_data_flow(task, context)
        elif task.type == "create_architecture_decision_records":
            return await self._create_adrs(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _design_system_architecture(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design overall system architecture"""
        requirements = task.inputs.get("requirements", {})
        planning_results = task.inputs.get("planning_results", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior software architect with expertise in designing scalable, maintainable systems. Design a comprehensive system architecture.

Include:
1. High-level architecture overview
2. Component breakdown
3. Service boundaries
4. Data flow diagrams
5. Technology stack mapping
6. Deployment architecture
7. Scalability considerations
8. Security considerations
9. Integration patterns
10. Architecture patterns used

Format as JSON:
{
    "architecture_overview": {
        "pattern": "microservices/monolith/serverless/etc",
        "description": "overview",
        "principles": ["design principles"],
        "quality_attributes": ["scalability", "security", "etc"]
    },
    "components": [
        {
            "name": "component name",
            "type": "service/library/database/etc",
            "responsibilities": ["list"],
            "interfaces": ["interfaces"],
            "dependencies": ["components"],
            "technology": "tech choice",
            "rationale": "why this choice"
        }
    ],
    "service_boundaries": {
        "service_name": {
            "domain": "business domain",
            "responsibilities": ["list"],
            "data_owned": ["data entities"],
            "apis_exposed": ["api endpoints"],
            "dependencies": ["other services"]
        }
    },
    "data_architecture": {
        "storage_strategy": "description",
        "data_flow": "description",
        "consistency_model": "eventual/strong/etc",
        "backup_strategy": "description"
    },
    "deployment_architecture": {
        "environments": ["dev/staging/prod"],
        "deployment_strategy": "blue-green/rolling/etc",
        "infrastructure": "cloud/on-premise/hybrid",
        "monitoring": "strategy",
        "logging": "strategy"
    },
    "integration_patterns": ["patterns used"],
    "cross_cutting_concerns": {
        "authentication": "strategy",
        "authorization": "strategy",
        "logging": "strategy",
        "monitoring": "strategy",
        "error_handling": "strategy",
        "caching": "strategy"
    },
    "trade_offs": [
        {
            "decision": "what was decided",
            "alternatives": ["other options"],
            "rationale": "why this choice",
            "consequences": ["implications"]
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design system architecture for:\nRequirements: {json.dumps(requirements, indent=2)}\nPlanning Results: {json.dumps(planning_results, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            architecture = json.loads(response.content)
            
            return {
                "system_architecture": architecture,
                "requirements": requirements,
                "planning_results": planning_results,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"System architecture design failed: {e}")
            raise
    
    async def _design_database(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design database schema and architecture"""
        requirements = task.inputs.get("requirements", {})
        tech_stack = task.inputs.get("tech_stack", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a database architect. Design a comprehensive database architecture and schema.

Include:
1. Database technology selection rationale
2. Schema design with relationships
3. Indexing strategy
4. Data partitioning strategy
5. Backup and recovery strategy
6. Performance optimization
7. Security considerations
8. Scalability approach
9. Migration strategy

Format as JSON:
{
    "database_selection": {
        "primary_db": "PostgreSQL/MongoDB/etc",
        "rationale": "why this choice",
        "alternatives_considered": ["other options"],
        "additional_stores": {
            "cache": "Redis/Memcached",
            "search": "Elasticsearch/etc",
            "analytics": "ClickHouse/etc"
        }
    },
    "schema_design": {
        "entities": [
            {
                "name": "entity name",
                "attributes": [
                    {
                        "name": "attribute",
                        "type": "data type",
                        "constraints": ["NOT NULL", "UNIQUE", "etc"],
                        "description": "purpose"
                    }
                ],
                "relationships": [
                    {
                        "type": "one-to-many/many-to-many/etc",
                        "target": "related entity",
                        "description": "relationship description"
                    }
                ],
                "indexes": ["index definitions"],
                "business_rules": ["rules"]
            }
        ],
        "views": ["view definitions"],
        "stored_procedures": ["procedure definitions"]
    },
    "performance_strategy": {
        "indexing": "strategy",
        "partitioning": "strategy",
        "caching": "strategy",
        "query_optimization": "strategy"
    },
    "scalability_strategy": {
        "read_replicas": "strategy",
        "sharding": "strategy",
        "connection_pooling": "strategy"
    },
    "security_strategy": {
        "authentication": "strategy",
        "authorization": "strategy",
        "encryption": "at rest and in transit",
        "audit_logging": "strategy"
    },
    "backup_recovery": {
        "backup_frequency": "schedule",
        "retention_policy": "policy",
        "recovery_strategy": "strategy",
        "disaster_recovery": "strategy"
    },
    "migration_strategy": {
        "versioning": "strategy",
        "rollback": "strategy",
        "data_migration": "strategy"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design database for:\nRequirements: {json.dumps(requirements, indent=2)}\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            database_design = json.loads(response.content)
            
            return {
                "database_design": database_design,
                "requirements": requirements,
                "tech_stack": tech_stack,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Database design failed: {e}")
            raise
    
    async def _design_api(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design REST API endpoints and contracts"""
        requirements = task.inputs.get("requirements", {})
        system_architecture = task.inputs.get("system_architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an API architect. Design comprehensive REST API specifications.

Include:
1. API design principles
2. Resource identification
3. Endpoint specifications
4. Request/response schemas
5. Authentication/authorization
6. Error handling
7. Rate limiting
8. Versioning strategy
9. Documentation strategy

Format as JSON (following OpenAPI 3.0 style):
{
    "api_design_principles": ["RESTful", "stateless", "etc"],
    "base_url": "https://api.example.com/v1",
    "authentication": {
        "type": "JWT/OAuth/API Key/etc",
        "implementation": "description"
    },
    "endpoints": [
        {
            "path": "/resource/{id}",
            "method": "GET/POST/PUT/DELETE",
            "description": "endpoint purpose",
            "parameters": [
                {
                    "name": "parameter",
                    "in": "path/query/header",
                    "type": "string/integer/etc",
                    "required": true,
                    "description": "purpose"
                }
            ],
            "request_schema": {
                "type": "object",
                "properties": {}
            },
            "response_schemas": {
                "200": {
                    "description": "success",
                    "schema": {}
                },
                "400": {
                    "description": "bad request",
                    "schema": {}
                }
            },
            "authorization": "required roles/permissions",
            "rate_limit": "requests per minute"
        }
    ],
    "data_models": {
        "model_name": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string/integer/etc",
                    "description": "purpose",
                    "example": "example value"
                }
            },
            "required": ["field1", "field2"]
        }
    },
    "error_handling": {
        "standard_errors": ["400", "401", "403", "404", "500"],
        "error_format": {
            "error": "error code",
            "message": "human readable",
            "details": "additional info"
        }
    },
    "versioning": {
        "strategy": "URL/header/etc",
        "current_version": "v1",
        "deprecation_policy": "policy"
    },
    "rate_limiting": {
        "strategy": "token bucket/etc",
        "default_limits": "requests per time"
    },
    "caching": {
        "strategy": "description",
        "cache_headers": ["headers to use"]
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design API for:\nRequirements: {json.dumps(requirements, indent=2)}\nSystem Architecture: {json.dumps(system_architecture, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            api_design = json.loads(response.content)
            
            return {
                "api_design": api_design,
                "requirements": requirements,
                "system_architecture": system_architecture,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"API design failed: {e}")
            raise
    
    async def _design_microservices(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design microservices architecture"""
        requirements = task.inputs.get("requirements", {})
        system_architecture = task.inputs.get("system_architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a microservices architect. Design a comprehensive microservices architecture.

Include:
1. Service decomposition strategy
2. Service boundaries
3. Inter-service communication
4. Data management
5. Service discovery
6. Load balancing
7. Circuit breakers
8. Monitoring and observability
9. Deployment strategy

Format as JSON:
{
    "decomposition_strategy": {
        "approach": "domain-driven/data-driven/etc",
        "principles": ["single responsibility", "etc"],
        "criteria": ["business capability", "etc"]
    },
    "services": [
        {
            "name": "service name",
            "domain": "business domain",
            "responsibilities": ["list"],
            "api_type": "REST/GraphQL/gRPC",
            "data_storage": "database type",
            "dependencies": ["other services"],
            "scalability_requirements": "description",
            "technology_stack": ["technologies"]
        }
    ],
    "communication_patterns": {
        "synchronous": {
            "protocol": "HTTP/gRPC",
            "patterns": ["request-response", "etc"]
        },
        "asynchronous": {
            "protocol": "message queue/event streaming",
            "patterns": ["event-driven", "pub-sub", "etc"]
        }
    },
    "data_management": {
        "strategy": "database per service/shared/etc",
        "consistency": "eventual/strong",
        "transactions": "saga/2PC/etc",
        "data_synchronization": "strategy"
    },
    "infrastructure_patterns": {
        "service_discovery": "Consul/Eureka/etc",
        "load_balancing": "strategy",
        "api_gateway": "technology",
        "circuit_breaker": "Hystrix/etc",
        "rate_limiting": "strategy"
    },
    "observability": {
        "logging": "centralized/distributed",
        "monitoring": "metrics strategy",
        "tracing": "distributed tracing",
        "health_checks": "strategy"
    },
    "deployment": {
        "containerization": "Docker/etc",
        "orchestration": "Kubernetes/etc",
        "ci_cd": "strategy",
        "blue_green": "strategy"
    },
    "security": {
        "authentication": "service-to-service auth",
        "authorization": "service policies",
        "encryption": "in-transit/at-rest"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design microservices for:\nRequirements: {json.dumps(requirements, indent=2)}\nSystem Architecture: {json.dumps(system_architecture, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            microservices_design = json.loads(response.content)
            
            return {
                "microservices_design": microservices_design,
                "requirements": requirements,
                "system_architecture": system_architecture,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Microservices design failed: {e}")
            raise
    
    async def _design_security_architecture(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design security architecture"""
        requirements = task.inputs.get("requirements", {})
        system_architecture = task.inputs.get("system_architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a security architect. Design comprehensive security architecture.

Include:
1. Security principles and framework
2. Authentication and authorization
3. Data protection
4. Network security
5. Application security
6. Infrastructure security
7. Compliance requirements
8. Incident response
9. Security monitoring

Format as JSON:
{
    "security_framework": {
        "principles": ["defense in depth", "least privilege", "etc"],
        "standards": ["OWASP", "NIST", "etc"],
        "compliance": ["GDPR", "SOC2", "etc"]
    },
    "authentication": {
        "strategy": "JWT/OAuth/SAML/etc",
        "multi_factor": "implementation",
        "session_management": "strategy",
        "password_policy": "requirements"
    },
    "authorization": {
        "model": "RBAC/ABAC/etc",
        "implementation": "strategy",
        "api_security": "strategy",
        "resource_protection": "strategy"
    },
    "data_protection": {
        "classification": "public/internal/confidential/etc",
        "encryption_at_rest": "strategy",
        "encryption_in_transit": "strategy",
        "key_management": "strategy",
        "data_masking": "strategy",
        "backup_security": "strategy"
    },
    "network_security": {
        "perimeter_security": "firewalls/WAF/etc",
        "network_segmentation": "strategy",
        "vpn": "strategy",
        "ddos_protection": "strategy"
    },
    "application_security": {
        "secure_coding": "practices",
        "input_validation": "strategy",
        "output_encoding": "strategy",
        "session_security": "strategy",
        "api_security": "strategy"
    },
    "infrastructure_security": {
        "server_hardening": "strategy",
        "container_security": "strategy",
        "cloud_security": "strategy",
        "secrets_management": "strategy"
    },
    "monitoring_detection": {
        "security_monitoring": "strategy",
        "intrusion_detection": "strategy",
        "vulnerability_scanning": "strategy",
        "log_analysis": "strategy"
    },
    "incident_response": {
        "response_plan": "strategy",
        "escalation": "procedures",
        "forensics": "strategy",
        "recovery": "strategy"
    },
    "security_testing": {
        "static_analysis": "tools",
        "dynamic_analysis": "tools",
        "penetration_testing": "strategy",
        "security_reviews": "process"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design security architecture for:\nRequirements: {json.dumps(requirements, indent=2)}\nSystem Architecture: {json.dumps(system_architecture, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            security_architecture = json.loads(response.content)
            
            return {
                "security_architecture": security_architecture,
                "requirements": requirements,
                "system_architecture": system_architecture,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Security architecture design failed: {e}")
            raise
    
    async def _design_data_flow(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Design data flow architecture"""
        system_architecture = task.inputs.get("system_architecture", {})
        database_design = task.inputs.get("database_design", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a data architect. Design comprehensive data flow architecture.

Include:
1. Data flow diagrams
2. Data transformation pipelines
3. Data integration patterns
4. Event flow
5. Batch processing
6. Real-time processing
7. Data quality
8. Data governance

Format as JSON:
{
    "data_flows": [
        {
            "name": "flow name",
            "source": "data source",
            "destination": "data destination",
            "transformation": "transformation logic",
            "frequency": "real-time/batch/scheduled",
            "volume": "expected data volume",
            "format": "JSON/XML/CSV/etc"
        }
    ],
    "integration_patterns": {
        "api_integration": "strategy",
        "message_queues": "strategy",
        "file_transfer": "strategy",
        "database_sync": "strategy"
    },
    "event_architecture": {
        "event_sourcing": "strategy",
        "event_streaming": "Kafka/etc",
        "cqrs": "implementation",
        "saga_pattern": "implementation"
    },
    "processing_patterns": {
        "batch_processing": {
            "framework": "Spark/Hadoop/etc",
            "schedule": "timing",
            "error_handling": "strategy"
        },
        "stream_processing": {
            "framework": "Kafka Streams/Flink/etc",
            "windowing": "strategy",
            "state_management": "strategy"
        }
    },
    "data_quality": {
        "validation_rules": ["rules"],
        "data_profiling": "strategy",
        "anomaly_detection": "strategy",
        "error_handling": "strategy"
    },
    "data_governance": {
        "data_lineage": "tracking strategy",
        "data_catalog": "strategy",
        "privacy": "strategy",
        "retention": "strategy"
    },
    "monitoring": {
        "data_pipeline_monitoring": "strategy",
        "data_quality_monitoring": "strategy",
        "performance_monitoring": "strategy"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Design data flow for:\nSystem Architecture: {json.dumps(system_architecture, indent=2)}\nDatabase Design: {json.dumps(database_design, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            data_flow = json.loads(response.content)
            
            return {
                "data_flow_design": data_flow,
                "system_architecture": system_architecture,
                "database_design": database_design,
                "design_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Data flow design failed: {e}")
            raise
    
    async def _create_adrs(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create Architecture Decision Records"""
        architecture_decisions = task.inputs.get("architecture_decisions", [])
        system_architecture = task.inputs.get("system_architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an architecture documentation specialist. Create comprehensive Architecture Decision Records (ADRs).

For each architectural decision, create an ADR with:
1. Title
2. Status (Proposed/Accepted/Deprecated/Superseded)
3. Context
4. Decision
5. Consequences
6. Alternatives considered
7. Related decisions

Format as JSON:
{
    "adrs": [
        {
            "id": "ADR-001",
            "title": "Decision title",
            "status": "Accepted/Proposed/etc",
            "date": "YYYY-MM-DD",
            "context": "Background and context",
            "decision": "What was decided",
            "rationale": "Why this decision",
            "consequences": {
                "positive": ["benefits"],
                "negative": ["drawbacks"],
                "neutral": ["other impacts"]
            },
            "alternatives": [
                {
                    "option": "alternative",
                    "pros": ["benefits"],
                    "cons": ["drawbacks"],
                    "rejected_reason": "why not chosen"
                }
            ],
            "related_decisions": ["ADR-002", "etc"],
            "references": ["links/documents"]
        }
    ],
    "decision_log": {
        "total_decisions": "count",
        "by_status": {
            "accepted": "count",
            "proposed": "count",
            "deprecated": "count"
        },
        "by_category": {
            "technology": "count",
            "pattern": "count",
            "process": "count"
        }
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Create ADRs for architecture decisions in:\nSystem Architecture: {json.dumps(system_architecture, indent=2)}\nSpecific Decisions: {architecture_decisions}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            adrs = json.loads(response.content)
            
            return {
                "architecture_decision_records": adrs,
                "system_architecture": system_architecture,
                "architecture_decisions": architecture_decisions,
                "creation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"ADR creation failed: {e}")
            raise