import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
from ..llm_adapter import LLMMessage, llm_manager

class FrontendAgent(BaseAgent):
    """Agent responsible for frontend development and UI/UX implementation"""
    
    def __init__(self):
        super().__init__("frontend-001", AgentType.FRONTEND)
        self.capabilities = [
            "ui_development",
            "component_design",
            "state_management",
            "responsive_design",
            "user_experience",
            "frontend_testing",
            "performance_optimization",
            "accessibility_implementation"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        """Check if this agent can handle the given task"""
        frontend_tasks = [
            "develop_frontend",
            "create_ui_components",
            "implement_state_management",
            "create_responsive_design",
            "implement_user_interface",
            "optimize_frontend_performance",
            "implement_accessibility",
            "create_frontend_tests"
        ]
        return task.type in frontend_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute frontend development tasks"""
        
        if task.type == "develop_frontend":
            return await self._develop_complete_frontend(task, context)
        elif task.type == "create_ui_components":
            return await self._create_ui_components(task, context)
        elif task.type == "implement_state_management":
            return await self._implement_state_management(task, context)
        elif task.type == "create_responsive_design":
            return await self._create_responsive_design(task, context)
        elif task.type == "implement_user_interface":
            return await self._implement_user_interface(task, context)
        elif task.type == "optimize_frontend_performance":
            return await self._optimize_frontend_performance(task, context)
        elif task.type == "implement_accessibility":
            return await self._implement_accessibility(task, context)
        elif task.type == "create_frontend_tests":
            return await self._create_frontend_tests(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _develop_complete_frontend(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Develop complete frontend application"""
        
        ui_requirements = task.inputs.get("ui_requirements", {})
        api_design = task.inputs.get("api_design", {})
        design_system = task.inputs.get("design_system", {})
        tech_stack = context.tech_stack
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a senior frontend developer creating modern, responsive web applications. Generate complete frontend implementation with best practices.

Create:
1. Component architecture and hierarchy
2. State management implementation
3. UI components with proper styling
4. API integration and data fetching
5. Routing and navigation
6. Forms and validation
7. Error handling and loading states
8. Responsive design implementation
9. Performance optimizations
10. Accessibility features

Use modern React patterns including:
- Functional components with hooks
- TypeScript for type safety
- CSS modules or styled-components
- Context API or Redux for state
- React Query for data fetching
- React Router for navigation
- Jest and React Testing Library for tests

Format as JSON:
{
    "frontend_structure": {
        "framework": "React",
        "language": "TypeScript",
        "styling": "Tailwind CSS",
        "state_management": "Context API + useReducer",
        "routing": "React Router",
        "testing": "Jest + React Testing Library"
    },
    "components": [
        {
            "name": "ComponentName",
            "type": "page|layout|ui|feature",
            "path": "src/components/ComponentName.tsx",
            "content": "complete React component code",
            "props_interface": "TypeScript interface for props",
            "description": "component purpose and functionality",
            "dependencies": ["other components used"],
            "styling": "CSS/styling approach used"
        }
    ],
    "pages": [
        {
            "name": "PageName", 
            "path": "src/pages/PageName.tsx",
            "route": "/page-route",
            "content": "complete page component code",
            "description": "page purpose and features",
            "components_used": ["ComponentName"]
        }
    ],
    "hooks": [
        {
            "name": "useCustomHook",
            "path": "src/hooks/useCustomHook.ts",
            "content": "custom hook implementation",
            "description": "hook purpose and usage",
            "dependencies": ["external dependencies"]
        }
    ],
    "services": [
        {
            "name": "apiService",
            "path": "src/services/api.ts",
            "content": "API service implementation",
            "description": "API integration and data fetching"
        }
    ],
    "utils": [
        {
            "name": "utilityFunction",
            "path": "src/utils/helpers.ts",
            "content": "utility functions",
            "description": "helper functions and utilities"
        }
    ],
    "styles": [
        {
            "name": "global styles",
            "path": "src/styles/globals.css",
            "content": "global CSS styles",
            "description": "global styling and variables"
        }
    ],
    "configuration": [
        {
            "name": "package.json",
            "content": "complete package.json with all dependencies",
            "description": "project configuration and dependencies"
        },
        {
            "name": "tsconfig.json",
            "content": "TypeScript configuration",
            "description": "TypeScript compiler options"
        },
        {
            "name": "tailwind.config.js",
            "content": "Tailwind CSS configuration",
            "description": "Tailwind CSS customization"
        }
    ],
    "features": [
        {
            "name": "Authentication",
            "description": "User authentication and authorization",
            "components": ["LoginForm", "ProtectedRoute"],
            "implementation_notes": "JWT token management with Context API"
        }
    ],
    "performance_optimizations": [
        {
            "technique": "Code splitting",
            "implementation": "React.lazy() for route-based splitting",
            "benefits": "Reduced initial bundle size"
        }
    ],
    "accessibility_features": [
        {
            "feature": "Keyboard navigation",
            "implementation": "Focus management and ARIA labels",
            "compliance": "WCAG 2.1 AA"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Develop complete frontend for:\n\nUI Requirements: {json.dumps(ui_requirements, indent=2)}\n\nAPI Design: {json.dumps(api_design, indent=2)}\n\nDesign System: {json.dumps(design_system, indent=2)}\n\nTech Stack: {tech_stack}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            frontend_implementation = json.loads(response.content)
            
            # Create actual files
            created_files = await self._create_frontend_files(frontend_implementation, context)
            
            return {
                "frontend_implementation": frontend_implementation,
                "created_files": created_files,
                "ui_requirements": ui_requirements,
                "api_design": api_design,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Frontend development failed: {e}")
            raise
    
    async def _create_ui_components(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create reusable UI components"""
        
        component_requirements = task.inputs.get("component_requirements", [])
        design_system = task.inputs.get("design_system", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a UI component library developer. Create reusable, accessible, and well-designed React components.

Component guidelines:
1. Use TypeScript for type safety
2. Follow component composition patterns
3. Implement proper accessibility (ARIA labels, keyboard navigation)
4. Use CSS modules or styled-components for styling
5. Include prop validation and default props
6. Add JSDoc comments for documentation
7. Follow design system guidelines
8. Implement responsive design
9. Handle loading and error states
10. Include unit tests

Format as JSON:
{
    "components": [
        {
            "name": "Button",
            "path": "src/components/ui/Button.tsx",
            "content": "complete React component with TypeScript",
            "props_interface": "TypeScript interface definition",
            "styles": "CSS modules or styled-components",
            "tests": "Jest + React Testing Library tests",
            "documentation": "Component usage documentation",
            "variants": ["primary", "secondary", "outline"],
            "accessibility_features": ["ARIA labels", "keyboard support"],
            "responsive_behavior": "responsive design implementation"
        }
    ],
    "component_library": {
        "index_file": "src/components/ui/index.ts",
        "story_files": "Storybook stories for components",
        "documentation": "Component library documentation"
    },
    "design_tokens": {
        "colors": "CSS custom properties for colors",
        "typography": "Font size and weight definitions",
        "spacing": "Margin and padding scale",
        "breakpoints": "Responsive breakpoint definitions"
    }
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Create UI components:\n\nComponent Requirements: {json.dumps(component_requirements, indent=2)}\n\nDesign System: {json.dumps(design_system, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            components = json.loads(response.content)
            
            return {
                "ui_components": components,
                "component_requirements": component_requirements,
                "design_system": design_system,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"UI component creation failed: {e}")
            raise
    
    async def _implement_state_management(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement state management solution"""
        
        state_requirements = task.inputs.get("state_requirements", {})
        application_data = task.inputs.get("application_data", {})
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a state management expert implementing robust state management for React applications.

Implementation approaches:
1. Context API with useReducer for complex state
2. Redux Toolkit for large applications
3. Zustand for simple state management
4. React Query for server state
5. Local state with useState for component state

Generate:
1. State structure and type definitions
2. Actions and reducers (if using Redux/useReducer)
3. Context providers and custom hooks
4. Selectors and state access patterns
5. Middleware for side effects
6. State persistence (if needed)
7. DevTools integration
8. Testing utilities

Format as JSON:
{
    "state_management": {
        "approach": "Context API + useReducer",
        "structure": "description of state organization",
        "benefits": ["benefit1", "benefit2"],
        "trade_offs": ["consideration1", "consideration2"]
    },
    "state_files": [
        {
            "name": "AppContext",
            "path": "src/context/AppContext.tsx",
            "content": "Context provider implementation",
            "description": "Main application context"
        },
        {
            "name": "AppReducer",
            "path": "src/context/AppReducer.ts",
            "content": "Reducer function implementation",
            "description": "State update logic"
        }
    ],
    "hooks": [
        {
            "name": "useAppState",
            "path": "src/hooks/useAppState.ts",
            "content": "Custom hook for state access",
            "description": "Hook for accessing application state"
        }
    ],
    "types": [
        {
            "name": "State types",
            "path": "src/types/state.ts",
            "content": "TypeScript type definitions",
            "description": "State and action type definitions"
        }
    ],
    "middleware": [
        {
            "name": "logger middleware",
            "path": "src/middleware/logger.ts", 
            "content": "Development logging middleware",
            "description": "State change logging for development"
        }
    ]
}"""
            ),
            LLMMessage(
                role="user",
                content=f"Implement state management:\n\nState Requirements: {json.dumps(state_requirements, indent=2)}\n\nApplication Data: {json.dumps(application_data, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            state_management = json.loads(response.content)
            
            return {
                "state_management": state_management,
                "state_requirements": state_requirements,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"State management implementation failed: {e}")
            raise
    
    async def _create_responsive_design(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create responsive design implementation"""
        
        design_requirements = task.inputs.get("design_requirements", {})
        target_devices = task.inputs.get("target_devices", [])
        
        # Generate responsive design system
        responsive_design = self._generate_responsive_system(design_requirements, target_devices)
        
        return {
            "responsive_design": responsive_design,
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _implement_user_interface(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement user interface based on designs"""
        
        ui_designs = task.inputs.get("ui_designs", {})
        user_flows = task.inputs.get("user_flows", [])
        
        # Generate UI implementation
        ui_implementation = self._create_ui_implementation(ui_designs, user_flows)
        
        return {
            "ui_implementation": ui_implementation,
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _optimize_frontend_performance(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Optimize frontend performance"""
        
        performance_requirements = task.inputs.get("performance_requirements", {})
        current_metrics = task.inputs.get("current_metrics", {})
        
        # Generate performance optimizations
        optimizations = self._create_performance_optimizations(performance_requirements, current_metrics)
        
        return {
            "performance_optimizations": optimizations,
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _implement_accessibility(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Implement accessibility features"""
        
        accessibility_requirements = task.inputs.get("accessibility_requirements", {})
        wcag_level = task.inputs.get("wcag_level", "AA")
        
        # Generate accessibility implementation
        accessibility_implementation = self._create_accessibility_features(accessibility_requirements, wcag_level)
        
        return {
            "accessibility_implementation": accessibility_implementation,
            "implementation_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _create_frontend_tests(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Create comprehensive frontend tests"""
        
        components = task.inputs.get("components", [])
        user_flows = task.inputs.get("user_flows", [])
        
        messages = [
            LLMMessage(
                role="system",
                content="""You are a frontend testing expert creating comprehensive test suites for React applications.

Testing strategy:
1. Unit tests for components (Jest + React Testing Library)
2. Integration tests for component interactions
3. End-to-end tests for user flows (Playwright/Cypress)
4. Visual regression tests (Storybook + Chromatic)
5. Accessibility tests (jest-axe)
6. Performance tests (Lighthouse CI)

Generate:
1. Component unit tests with multiple scenarios
2. Custom hook tests
3. Integration tests for complex workflows
4. E2E test scenarios
5. Test utilities and setup files
6. Mock data and test fixtures
7. CI/CD test configuration

Format as JSON with complete test implementations."""
            ),
            LLMMessage(
                role="user",
                content=f"Create frontend tests for:\n\nComponents: {json.dumps(components, indent=2)}\n\nUser Flows: {json.dumps(user_flows, indent=2)}"
            )
        ]
        
        try:
            response = await llm_manager.complete_with_fallback(messages)
            tests = json.loads(response.content)
            
            return {
                "frontend_tests": tests,
                "components": components,
                "user_flows": user_flows,
                "implementation_timestamp": datetime.utcnow().isoformat(),
                "tokens_used": response.tokens_used
            }
        except Exception as e:
            self.logger.error(f"Frontend test creation failed: {e}")
            raise
    
    async def _create_frontend_files(self, implementation: Dict[str, Any], context: AgentExecutionContext) -> List[str]:
        """Create actual frontend files from implementation"""
        created_files = []
        workspace_path = context.workspace_path
        
        try:
            import os
            
            # Create components
            components = implementation.get("components", [])
            for component in components:
                file_path = os.path.join(workspace_path, "frontend", component["path"])
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                with open(file_path, 'w') as f:
                    f.write(component["content"])
                created_files.append(file_path)
            
            # Create pages
            pages = implementation.get("pages", [])
            for page in pages:
                file_path = os.path.join(workspace_path, "frontend", page["path"])
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                with open(file_path, 'w') as f:
                    f.write(page["content"])
                created_files.append(file_path)
            
            # Create hooks
            hooks = implementation.get("hooks", [])
            for hook in hooks:
                file_path = os.path.join(workspace_path, "frontend", hook["path"])
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                with open(file_path, 'w') as f:
                    f.write(hook["content"])
                created_files.append(file_path)
            
            # Create services
            services = implementation.get("services", [])
            for service in services:
                file_path = os.path.join(workspace_path, "frontend", service["path"])
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                with open(file_path, 'w') as f:
                    f.write(service["content"])
                created_files.append(file_path)
            
            # Create configuration files
            config_files = implementation.get("configuration", [])
            for config in config_files:
                file_path = os.path.join(workspace_path, "frontend", config["name"])
                
                with open(file_path, 'w') as f:
                    f.write(config["content"])
                created_files.append(file_path)
            
            self.logger.info(f"Created {len(created_files)} frontend files")
            return created_files
            
        except Exception as e:
            self.logger.error(f"Failed to create frontend files: {e}")
            raise
    
    def _generate_responsive_system(self, requirements: Dict, target_devices: List) -> Dict:
        """Generate responsive design system"""
        return {
            "breakpoints": {
                "mobile": "320px",
                "tablet": "768px", 
                "desktop": "1024px",
                "large": "1440px"
            },
            "grid_system": "CSS Grid with flexbox fallback",
            "fluid_typography": "clamp() for responsive font sizes",
            "responsive_images": "srcset and sizes attributes",
            "mobile_first": True
        }
    
    def _create_ui_implementation(self, designs: Dict, user_flows: List) -> Dict:
        """Create UI implementation from designs"""
        return {
            "layout_system": "CSS Grid + Flexbox",
            "component_library": "Custom components with design system",
            "navigation": "Responsive navigation with mobile menu",
            "forms": "Accessible forms with validation",
            "data_display": "Tables, cards, and lists for data presentation"
        }
    
    def _create_performance_optimizations(self, requirements: Dict, metrics: Dict) -> Dict:
        """Create performance optimization strategies"""
        return {
            "code_splitting": "Route-based and component-based splitting",
            "lazy_loading": "Images and components",
            "bundle_optimization": "Tree shaking and minification",
            "caching": "Service worker and browser caching",
            "image_optimization": "WebP format and responsive images"
        }
    
    def _create_accessibility_features(self, requirements: Dict, wcag_level: str) -> Dict:
        """Create accessibility implementation"""
        return {
            "keyboard_navigation": "Full keyboard accessibility",
            "screen_reader": "ARIA labels and semantic HTML",
            "color_contrast": f"WCAG {wcag_level} compliant contrast ratios",
            "focus_management": "Visible focus indicators",
            "alternative_text": "Descriptive alt text for images"
        }