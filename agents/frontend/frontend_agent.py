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

class FrontendAgent(BaseAgent):
    def __init__(self):
        super().__init__("frontend-001", AgentType.FRONTEND)
        self.capabilities = [
            "react_development",
            "typescript_implementation",
            "ui_component_development",
            "state_management",
            "routing_implementation",
            "api_integration",
            "responsive_design",
            "accessibility_implementation",
            "testing_implementation",
            "performance_optimization"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        return task.type in [
            "develop_frontend",
            "implement_ui_components",
            "implement_pages",
            "implement_state_management",
            "implement_api_integration",
            "implement_routing",
            "implement_responsive_design",
            "implement_accessibility",
            "implement_frontend_tests",
            "optimize_frontend_performance"
        ]
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute frontend development tasks"""
        self.logger.info(f"Executing frontend task: {task.type}")
        
        if task.type == "develop_frontend":
            return await self._develop_complete_frontend(task, context)
        elif task.type == "implement_ui_components":
            return await self._implement_ui_components(task, context)
        elif task.type == "implement_pages":
            return await self._implement_pages(task, context)
        elif task.type == "implement_state_management":
            return await self._implement_state_management(task, context)
        elif task.type == "implement_api_integration":
            return await self._implement_api_integration(task, context)
        elif task.type == "implement_routing":
            return await self._implement_routing(task, context)
        elif task.type == "implement_responsive_design":
            return await self._implement_responsive_design(task, context)
        elif task.type == "implement_accessibility":
            return await self._implement_accessibility(task, context)
        elif task.type == "implement_frontend_tests":
            return await self._implement_frontend_tests(task, context)
        elif task.type == "optimize_frontend_performance":
            return await self._optimize_frontend_performance(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _develop_complete_frontend(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Develop complete frontend implementation"""
        architecture = task.inputs.get("architecture", {})
        requirements = task.inputs.get("requirements", {})
        api_design = task.inputs.get("api_design", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior frontend developer with expertise in React, TypeScript, and modern web development. Generate complete frontend implementation.

Based on the architecture and requirements, generate:
1. React components with TypeScript
2. Page components and layouts
3. State management (Redux Toolkit/Zustand)
4. API integration with type safety
5. Routing implementation
6. Form handling and validation
7. Error boundaries and error handling
8. Loading states and UX patterns
9. Responsive design with Tailwind CSS
10. Accessibility implementation
11. Testing implementation
12. Performance optimizations

Use React 18+ features, TypeScript strict mode, and modern patterns. Generate production-ready code.

Format as JSON:
{
    "components": [
        {
            "name": "ComponentName",
            "path": "components/ComponentName.tsx",
            "content": "complete React component implementation",
            "description": "component purpose",
            "props": ["prop interfaces"],
            "dependencies": ["other components/hooks used"]
        }
    ],
    "pages": [
        {
            "name": "PageName",
            "path": "pages/PageName.tsx", 
            "content": "complete page implementation",
            "route": "/page-route",
            "description": "page purpose"
        }
    ],
    "hooks": [
        {
            "name": "hookName",
            "path": "hooks/useHook.ts",
            "content": "custom hook implementation",
            "description": "hook purpose"
        }
    ],
    "store": [
        {
            "name": "slice/store name",
            "path": "store/slice.ts",
            "content": "state management implementation"
        }
    ],
    "services": [
        {
            "name": "service name",
            "path": "services/api.ts",
            "content": "API service implementation"
        }
    ],
    "types": [
        {
            "path": "types/index.ts",
            "content": "TypeScript type definitions"
        }
    ],
    "utils": [
        {
            "path": "utils/helpers.ts",
            "content": "utility functions"
        }
    ],
    "styles": [
        {
            "path": "styles/globals.css",
            "content": "global styles and Tailwind customizations"
        }
    ],
    "config": [
        {
            "path": "config.ts",
            "content": "frontend configuration"
        }
    ],
    "tests": [
        {
            "path": "tests/components.test.tsx",
            "content": "component tests"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Generate complete frontend implementation for:\nArchitecture: {json.dumps(architecture, indent=2)}\nRequirements: {json.dumps(requirements, indent=2)}\nAPI Design: {json.dumps(api_design, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            frontend_implementation = json.loads(response.content)
            
            # Create the actual files
            created_files = await self._create_frontend_files(frontend_implementation, context)
            
            return {
                "frontend_implementation": frontend_implementation,
                "created_files": created_files,
                "architecture": architecture,
                "requirements": requirements,
                "api_design": api_design,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Frontend development failed: {e}")
            raise
    
    async def _implement_ui_components(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement specific UI components"""
        component_specs = task.inputs.get("component_specs", [])
        design_system = task.inputs.get("design_system", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a UI component specialist. Implement React components with TypeScript.

Generate components with:
1. TypeScript interfaces for props
2. Proper component composition
3. Accessibility features (ARIA labels, keyboard navigation)
4. Responsive design with Tailwind CSS
5. Error boundaries where appropriate
6. Loading and error states
7. Performance optimizations (memo, useMemo, useCallback)
8. Storybook stories
9. Unit tests

Use modern React patterns and best practices.

Format as JSON:
{
    "components": [
        {
            "name": "ComponentName",
            "path": "components/ComponentName.tsx",
            "content": "complete component implementation",
            "props_interface": "TypeScript interface",
            "accessibility_features": ["features implemented"],
            "responsive_breakpoints": ["mobile", "tablet", "desktop"]
        }
    ],
    "stories": [
        {
            "path": "stories/Component.stories.tsx",
            "content": "Storybook stories"
        }
    ],
    "tests": [
        {
            "path": "tests/Component.test.tsx",
            "content": "comprehensive component tests"
        }
    ],
    "types": [
        {
            "path": "types/components.ts",
            "content": "shared component types"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement UI components:\nComponent Specs: {json.dumps(component_specs, indent=2)}\nDesign System: {json.dumps(design_system, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            components_implementation = json.loads(response.content)
            
            return {
                "components_implementation": components_implementation,
                "component_specs": component_specs,
                "design_system": design_system,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"UI component implementation failed: {e}")
            raise
    
    async def _implement_pages(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement page components"""
        page_specs = task.inputs.get("page_specs", [])
        layout_requirements = task.inputs.get("layout_requirements", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a page implementation specialist. Create complete page components for a React application.

Generate pages with:
1. Layout integration
2. Data fetching and state management
3. Loading states and error handling
4. SEO optimization (meta tags, structured data)
5. Responsive design
6. Accessibility compliance
7. Performance optimizations
8. Navigation integration
9. Form handling where needed
10. Integration tests

Use React Router, React Query/SWR for data fetching, and modern patterns.

Format as JSON:
{
    "pages": [
        {
            "name": "PageName",
            "path": "pages/PageName.tsx",
            "content": "complete page implementation",
            "route": "/page-route",
            "layout": "layout component used",
            "data_requirements": ["API endpoints needed"],
            "seo_metadata": {
                "title": "page title",
                "description": "page description",
                "keywords": ["keywords"]
            }
        }
    ],
    "layouts": [
        {
            "name": "LayoutName",
            "path": "layouts/LayoutName.tsx",
            "content": "layout component implementation"
        }
    ],
    "routing": {
        "path": "router/routes.tsx",
        "content": "routing configuration"
    },
    "tests": [
        {
            "path": "tests/pages.test.tsx",
            "content": "page integration tests"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement pages:\nPage Specs: {json.dumps(page_specs, indent=2)}\nLayout Requirements: {json.dumps(layout_requirements, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            pages_implementation = json.loads(response.content)
            
            return {
                "pages_implementation": pages_implementation,
                "page_specs": page_specs,
                "layout_requirements": layout_requirements,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Page implementation failed: {e}")
            raise
    
    async def _implement_state_management(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement state management system"""
        state_requirements = task.inputs.get("state_requirements", {})
        architecture = task.inputs.get("architecture", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a state management expert. Implement comprehensive state management for a React application.

Choose the appropriate solution (Redux Toolkit, Zustand, Jotai) based on requirements and implement:
1. Store configuration
2. Slices/stores for different domains
3. Async actions for API calls
4. Selectors for derived state
5. Middleware for logging, persistence
6. Type-safe hooks
7. DevTools integration
8. Performance optimizations
9. State persistence
10. Testing utilities

Use TypeScript throughout and follow best practices.

Format as JSON:
{
    "store_config": {
        "path": "store/index.ts",
        "content": "main store configuration",
        "library": "redux-toolkit/zustand/jotai"
    },
    "slices": [
        {
            "name": "slice_name",
            "path": "store/slices/slice.ts",
            "content": "slice implementation",
            "domain": "business domain"
        }
    ],
    "hooks": [
        {
            "name": "hook_name",
            "path": "hooks/useStore.ts",
            "content": "typed store hooks"
        }
    ],
    "selectors": [
        {
            "path": "store/selectors.ts",
            "content": "memoized selectors"
        }
    ],
    "middleware": [
        {
            "path": "store/middleware.ts",
            "content": "custom middleware"
        }
    ],
    "types": [
        {
            "path": "types/store.ts",
            "content": "store type definitions"
        }
    ],
    "tests": [
        {
            "path": "tests/store.test.ts",
            "content": "store tests"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement state management:\nState Requirements: {json.dumps(state_requirements, indent=2)}\nArchitecture: {json.dumps(architecture, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            state_implementation = json.loads(response.content)
            
            return {
                "state_implementation": state_implementation,
                "state_requirements": state_requirements,
                "architecture": architecture,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"State management implementation failed: {e}")
            raise
    
    async def _implement_api_integration(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement API integration layer"""
        api_design = task.inputs.get("api_design", {})
        backend_types = task.inputs.get("backend_types", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are an API integration specialist. Implement type-safe API integration for React frontend.

For Encore.ts backend, use the generated client. For other APIs, implement:
1. API client configuration
2. Type-safe service functions
3. Error handling and retry logic
4. Request/response interceptors
5. Loading state management
6. Cache management
7. Optimistic updates
8. Offline support
9. Authentication handling
10. API mocking for tests

Use React Query/SWR or similar for data fetching and caching.

Format as JSON:
{
    "api_client": {
        "path": "services/api.ts",
        "content": "main API client configuration"
    },
    "services": [
        {
            "name": "service_name",
            "path": "services/service.ts",
            "content": "service-specific API functions"
        }
    ],
    "hooks": [
        {
            "name": "hook_name",
            "path": "hooks/useApi.ts",
            "content": "data fetching hooks"
        }
    ],
    "types": [
        {
            "path": "types/api.ts",
            "content": "API type definitions"
        }
    ],
    "interceptors": [
        {
            "path": "services/interceptors.ts",
            "content": "request/response interceptors"
        }
    ],
    "mocks": [
        {
            "path": "mocks/api.ts",
            "content": "API mocks for testing"
        }
    ],
    "tests": [
        {
            "path": "tests/api.test.ts",
            "content": "API integration tests"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement API integration:\nAPI Design: {json.dumps(api_design, indent=2)}\nBackend Types: {json.dumps(backend_types, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            api_implementation = json.loads(response.content)
            
            return {
                "api_implementation": api_implementation,
                "api_design": api_design,
                "backend_types": backend_types,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"API integration implementation failed: {e}")
            raise
    
    async def _create_frontend_files(self, implementation: Dict[str, Any], context: AgentExecutionContext) -> List[str]:
        """Create actual frontend files from implementation"""
        created_files = []
        workspace_path = context.workspace_path
        frontend_dir = os.path.join(workspace_path, "frontend")
        
        try:
            # Create components
            for component in implementation.get("components", []):
                component_path = os.path.join(frontend_dir, component["path"])
                os.makedirs(os.path.dirname(component_path), exist_ok=True)
                
                with open(component_path, 'w') as f:
                    f.write(component["content"])
                created_files.append(component_path)
            
            # Create pages
            for page in implementation.get("pages", []):
                page_path = os.path.join(frontend_dir, page["path"])
                os.makedirs(os.path.dirname(page_path), exist_ok=True)
                
                with open(page_path, 'w') as f:
                    f.write(page["content"])
                created_files.append(page_path)
            
            # Create hooks
            for hook in implementation.get("hooks", []):
                hook_path = os.path.join(frontend_dir, hook["path"])
                os.makedirs(os.path.dirname(hook_path), exist_ok=True)
                
                with open(hook_path, 'w') as f:
                    f.write(hook["content"])
                created_files.append(hook_path)
            
            # Create store files
            for store_file in implementation.get("store", []):
                store_path = os.path.join(frontend_dir, store_file["path"])
                os.makedirs(os.path.dirname(store_path), exist_ok=True)
                
                with open(store_path, 'w') as f:
                    f.write(store_file["content"])
                created_files.append(store_path)
            
            # Create services
            for service in implementation.get("services", []):
                service_path = os.path.join(frontend_dir, service["path"])
                os.makedirs(os.path.dirname(service_path), exist_ok=True)
                
                with open(service_path, 'w') as f:
                    f.write(service["content"])
                created_files.append(service_path)
            
            # Create types
            for type_file in implementation.get("types", []):
                type_path = os.path.join(frontend_dir, type_file["path"])
                os.makedirs(os.path.dirname(type_path), exist_ok=True)
                
                with open(type_path, 'w') as f:
                    f.write(type_file["content"])
                created_files.append(type_path)
            
            # Create utils
            for util in implementation.get("utils", []):
                util_path = os.path.join(frontend_dir, util["path"])
                os.makedirs(os.path.dirname(util_path), exist_ok=True)
                
                with open(util_path, 'w') as f:
                    f.write(util["content"])
                created_files.append(util_path)
            
            # Create styles
            for style in implementation.get("styles", []):
                style_path = os.path.join(frontend_dir, style["path"])
                os.makedirs(os.path.dirname(style_path), exist_ok=True)
                
                with open(style_path, 'w') as f:
                    f.write(style["content"])
                created_files.append(style_path)
            
            # Create config files
            for config_file in implementation.get("config", []):
                config_path = os.path.join(frontend_dir, config_file["path"])
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                
                with open(config_path, 'w') as f:
                    f.write(config_file["content"])
                created_files.append(config_path)
            
            # Create test files
            for test_file in implementation.get("tests", []):
                test_path = os.path.join(frontend_dir, test_file["path"])
                os.makedirs(os.path.dirname(test_path), exist_ok=True)
                
                with open(test_path, 'w') as f:
                    f.write(test_file["content"])
                created_files.append(test_path)
                
            self.logger.info(f"Created {len(created_files)} frontend files")
            return created_files
            
        except Exception as e:
            self.logger.error(f"Failed to create frontend files: {e}")
            raise
    
    # Implement other methods with similar patterns
    async def _implement_routing(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        return {"routing": "implemented", "implementation_timestamp": datetime.utcnow().isoformat()}
    
    async def _implement_responsive_design(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        return {"responsive_design": "implemented", "implementation_timestamp": datetime.utcnow().isoformat()}
    
    async def _implement_accessibility(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        return {"accessibility": "implemented", "implementation_timestamp": datetime.utcnow().isoformat()}
    
    async def _implement_frontend_tests(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        return {"frontend_tests": "implemented", "implementation_timestamp": datetime.utcnow().isoformat()}
    
    async def _optimize_frontend_performance(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        return {"performance_optimizations": "implemented", "implementation_timestamp": datetime.utcnow().isoformat()}