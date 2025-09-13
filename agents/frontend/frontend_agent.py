import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..base_agent import BaseAgent, AgentType, Task, TaskPriority, AgentExecutionContext
import uuid

class FrontendAgent(BaseAgent):
    def __init__(self):
        super().__init__("frontend-001", AgentType.FRONTEND_DEVELOPER)
        self.capabilities = [
            "react_development",
            "component_creation",
            "ui_design",
            "state_management",
            "routing_setup",
            "form_handling",
            "responsive_design",
            "accessibility",
            "performance_optimization"
        ]
        self.supported_frameworks = [
            "react", "vue", "angular", "svelte", "nextjs", "nuxt"
        ]
        self.logger = logging.getLogger(__name__)
        
    def can_handle_task(self, task: Task) -> bool:
        frontend_tasks = [
            "develop_frontend", "create_components", "setup_routing",
            "implement_forms", "create_pages", "setup_state_management",
            "implement_ui_design", "optimize_performance"
        ]
        return task.type in frontend_tasks
    
    async def execute_task(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Execute frontend development tasks"""
        if task.type == "develop_frontend":
            return await self._develop_complete_frontend(task, context)
        elif task.type == "create_components":
            return await self._create_ui_components(task, context)
        elif task.type == "setup_routing":
            return await self._setup_application_routing(task, context)
        elif task.type == "implement_forms":
            return await self._implement_form_handling(task, context)
        else:
            raise ValueError(f"Unknown task type: {task.type}")
    
    async def _develop_complete_frontend(self, task: Task, context: AgentExecutionContext) -> Dict[str, Any]:
        """Generate complete frontend implementation"""
        self.logger.info(f"Developing complete frontend for project: {context.project_id}")
        
        # Extract requirements from task inputs
        architecture = task.inputs.get("architecture", {})
        requirements = task.inputs.get("requirements", {})
        tech_stack = context.tech_stack
        
        # Determine frontend framework
        framework = self._select_frontend_framework(tech_stack, requirements)
        
        # Generate frontend structure
        frontend_structure = await self._generate_frontend_structure(framework, requirements)
        
        # Generate components
        components = await self._generate_ui_components(requirements, framework)
        
        # Generate pages/views
        pages = await self._generate_application_pages(requirements, framework)
        
        # Generate routing
        routing = await self._generate_routing_system(framework, pages)
        
        # Generate state management
        state_management = await self._generate_state_management(framework, requirements)
        
        # Generate styles
        styles = await self._generate_styling_system(framework, requirements)
        
        # Generate utilities and hooks
        utilities = await self._generate_frontend_utilities(framework, requirements)
        
        # Generate tests
        tests = await self._generate_frontend_tests(framework, components, pages)
        
        return {
            "framework": framework,
            "structure": frontend_structure,
            "components": components,
            "pages": pages,
            "routing": routing,
            "state_management": state_management,
            "styles": styles,
            "utilities": utilities,
            "tests": tests,
            "files_generated": len(frontend_structure["files"]),
            "quality_score": await self._calculate_frontend_quality_score(
                components, pages, tests
            )
        }
    
    def _select_frontend_framework(self, tech_stack: Dict[str, Any], requirements: Dict[str, Any]) -> str:
        """Select the most appropriate frontend framework"""
        preferred = tech_stack.get("frontend_framework", "").lower()
        
        if preferred in self.supported_frameworks:
            return preferred
        
        # Default selection based on requirements
        if requirements.get("ssr", False):
            return "nextjs"  # Server-side rendering
        elif requirements.get("mobile_responsive", True):
            return "react"   # Great mobile support
        elif requirements.get("performance_critical", False):
            return "svelte"  # Smaller bundle size
        else:
            return "react"   # Most versatile and popular
    
    async def _generate_frontend_structure(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate frontend project structure"""
        if framework == "react":
            return await self._generate_react_structure(requirements)
        elif framework == "nextjs":
            return await self._generate_nextjs_structure(requirements)
        elif framework == "vue":
            return await self._generate_vue_structure(requirements)
        else:
            return await self._generate_generic_frontend_structure(framework, requirements)
    
    async def _generate_react_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate React project structure"""
        base_structure = {
            "directories": [
                "src/",
                "src/components/",
                "src/components/ui/",
                "src/pages/",
                "src/hooks/",
                "src/context/",
                "src/services/",
                "src/utils/",
                "src/types/",
                "src/assets/",
                "src/styles/",
                "public/",
                "tests/",
                "tests/components/",
                "tests/pages/"
            ],
            "files": [
                {
                    "path": "package.json",
                    "content": self._generate_react_package_json(requirements),
                    "description": "Project dependencies and scripts"
                },
                {
                    "path": "src/App.tsx",
                    "content": self._generate_react_app_component(requirements),
                    "description": "Main application component"
                },
                {
                    "path": "src/main.tsx",
                    "content": self._generate_react_main_file(),
                    "description": "Application entry point"
                },
                {
                    "path": "src/index.css",
                    "content": self._generate_global_styles(requirements),
                    "description": "Global styles"
                },
                {
                    "path": "tsconfig.json",
                    "content": self._generate_typescript_config(),
                    "description": "TypeScript configuration"
                },
                {
                    "path": "vite.config.ts",
                    "content": self._generate_vite_config(),
                    "description": "Vite build configuration"
                },
                {
                    "path": "tailwind.config.js",
                    "content": self._generate_tailwind_config(),
                    "description": "Tailwind CSS configuration"
                }
            ]
        }
        
        # Add routing if needed
        if requirements.get("routing", True):
            base_structure["files"].append({
                "path": "src/router.tsx",
                "content": self._generate_react_router(),
                "description": "Application routing setup"
            })
        
        # Add state management
        if requirements.get("state_management", True):
            base_structure["files"].append({
                "path": "src/store/index.ts",
                "content": self._generate_redux_store(),
                "description": "Redux store configuration"
            })
        
        return base_structure
    
    def _generate_react_package_json(self, requirements: Dict[str, Any]) -> str:
        """Generate package.json for React project"""
        dependencies = {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "@types/react": "^18.2.43",
            "@types/react-dom": "^18.2.17",
            "typescript": "^5.2.2",
            "vite": "^5.0.8",
            "@vitejs/plugin-react": "^4.2.1",
            "tailwindcss": "^3.3.6",
            "autoprefixer": "^10.4.16",
            "postcss": "^8.4.32"
        }
        
        if requirements.get("routing", True):
            dependencies.update({
                "react-router-dom": "^6.20.1",
                "@types/react-router-dom": "^5.3.3"
            })
        
        if requirements.get("state_management", True):
            dependencies.update({
                "@reduxjs/toolkit": "^2.0.1",
                "react-redux": "^9.0.4"
            })
        
        if requirements.get("forms", True):
            dependencies.update({
                "react-hook-form": "^7.48.2",
                "@hookform/resolvers": "^3.3.2",
                "zod": "^3.22.4"
            })
        
        if requirements.get("api_integration", True):
            dependencies.update({
                "@tanstack/react-query": "^5.8.4",
                "axios": "^1.6.2"
            })
        
        package = {
            "name": requirements.get("name", "react-app"),
            "private": True,
            "version": "0.0.0",
            "type": "module",
            "scripts": {
                "dev": "vite",
                "build": "tsc && vite build",
                "preview": "vite preview",
                "test": "vitest",
                "test:ui": "vitest --ui",
                "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
            },
            "dependencies": dependencies,
            "devDependencies": {
                "@types/node": "^20.10.4",
                "eslint": "^8.55.0",
                "@typescript-eslint/eslint-plugin": "^6.13.1",
                "@typescript-eslint/parser": "^6.13.1",
                "eslint-plugin-react-hooks": "^4.6.0",
                "eslint-plugin-react-refresh": "^0.4.5",
                "vitest": "^1.0.4",
                "@testing-library/react": "^14.1.2",
                "@testing-library/jest-dom": "^6.1.5",
                "jsdom": "^23.0.1"
            }
        }
        
        return json.dumps(package, indent=2)
    
    def _generate_react_app_component(self, requirements: Dict[str, Any]) -> str:
        """Generate main React App component"""
        has_routing = requirements.get("routing", True)
        has_state = requirements.get("state_management", True)
        
        imports = ["import React from 'react';"]
        
        if has_routing:
            imports.append("import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';")
        
        if has_state:
            imports.append("import { Provider } from 'react-redux';")
            imports.append("import { store } from './store';")
        
        imports.extend([
            "import './index.css';",
            "import HomePage from './pages/HomePage';",
            "import Header from './components/Header';",
            "import Footer from './components/Footer';"
        ])
        
        component_content = '''
function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">'''
        
        if has_routing:
            component_content += '''
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* Add more routes here */}
          </Routes>
        </Router>'''
        else:
            component_content += '''
        <HomePage />'''
        
        component_content += '''
      </main>
      <Footer />
    </div>
  );
}'''
        
        if has_state:
            app_wrapper = '''
function AppWrapper() {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

export default AppWrapper;'''
        else:
            app_wrapper = '''
export default App;'''
        
        return '\\n'.join(imports) + component_content + app_wrapper
    
    async def _generate_ui_components(self, requirements: Dict[str, Any], framework: str) -> List[Dict]:
        """Generate UI components based on requirements"""
        components = []
        
        # Common components
        common_components = [
            {
                "name": "Header",
                "type": "layout",
                "description": "Application header with navigation",
                "props": ["title", "navigation"]
            },
            {
                "name": "Footer", 
                "type": "layout",
                "description": "Application footer",
                "props": ["links", "copyright"]
            },
            {
                "name": "Button",
                "type": "ui",
                "description": "Reusable button component",
                "props": ["variant", "size", "disabled", "onClick"]
            },
            {
                "name": "Input",
                "type": "form",
                "description": "Form input component",
                "props": ["type", "placeholder", "value", "onChange", "error"]
            },
            {
                "name": "Modal",
                "type": "ui",
                "description": "Modal dialog component",
                "props": ["isOpen", "onClose", "title", "children"]
            }
        ]
        
        # Add components based on requirements
        if requirements.get("forms", True):
            common_components.extend([
                {
                    "name": "Form",
                    "type": "form",
                    "description": "Form wrapper with validation",
                    "props": ["onSubmit", "schema", "children"]
                },
                {
                    "name": "Select",
                    "type": "form", 
                    "description": "Select dropdown component",
                    "props": ["options", "value", "onChange", "placeholder"]
                }
            ])
        
        if requirements.get("data_tables", True):
            common_components.append({
                "name": "DataTable",
                "type": "data",
                "description": "Data table with sorting and filtering",
                "props": ["data", "columns", "onSort", "onFilter"]
            })
        
        if requirements.get("charts", True):
            common_components.append({
                "name": "Chart",
                "type": "visualization",
                "description": "Chart component for data visualization",
                "props": ["type", "data", "options"]
            })
        
        return common_components
    
    async def _calculate_frontend_quality_score(self, components: List[Dict], pages: List[Dict], tests: List[Dict]) -> float:
        """Calculate quality score for frontend implementation"""
        score = 0.0
        max_score = 100.0
        
        # Components quality (40 points)
        if components:
            component_score = min(40, len(components) * 4)
            score += component_score
        
        # Pages quality (30 points) 
        if pages:
            page_score = min(30, len(pages) * 6)
            score += page_score
        
        # Test coverage (30 points)
        if tests:
            test_score = min(30, len(tests) * 5)
            score += test_score
        
        return min(100.0, (score / max_score) * 100)
    
    # Placeholder methods for other implementations
    def _generate_react_main_file(self) -> str:
        return '''import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);'''
    
    def _generate_global_styles(self, requirements: Dict[str, Any]) -> str:
        return '''@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}'''
    
    def _generate_typescript_config(self) -> str:
        return '''{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}'''
    
    def _generate_vite_config(self) -> str:
        return '''import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});'''
    
    def _generate_tailwind_config(self) -> str:
        return '''/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};'''
    
    # Additional placeholder methods
    async def _generate_nextjs_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {"directories": [], "files": []}
    
    async def _generate_vue_structure(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {"directories": [], "files": []}
    
    async def _generate_generic_frontend_structure(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {"directories": [], "files": []}
    
    async def _generate_application_pages(self, requirements: Dict[str, Any], framework: str) -> List[Dict]:
        return []
    
    async def _generate_routing_system(self, framework: str, pages: List[Dict]) -> Dict[str, Any]:
        return {}
    
    async def _generate_state_management(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {}
    
    async def _generate_styling_system(self, framework: str, requirements: Dict[str, Any]) -> Dict[str, Any]:
        return {}
    
    async def _generate_frontend_utilities(self, framework: str, requirements: Dict[str, Any]) -> List[Dict]:
        return []
    
    async def _generate_frontend_tests(self, framework: str, components: List[Dict], pages: List[Dict]) -> List[Dict]:
        return []
    
    def _generate_react_router(self) -> str:
        return "// React router setup"
    
    def _generate_redux_store(self) -> str:
        return "// Redux store setup"