-- Initial seed data for MYCO platform
-- This script populates the database with essential data for development and testing

BEGIN;

-- Insert default admin user
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'admin@myco.dev',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewweEe.fPKiA0N.2', -- password: admin123
    'Admin',
    'User',
    'admin',
    true
);

-- Insert demo organization
INSERT INTO organizations (id, name, slug, description, plan) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'MYCO Demo Organization',
    'myco-demo',
    'Default organization for demonstration purposes',
    'pro'
);

-- Add admin to organization
INSERT INTO organization_members (organization_id, user_id, role) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner'
);

-- Insert project templates
INSERT INTO project_templates (id, name, description, category, tech_stack, config, files, created_by) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'React TypeScript App',
    'Modern React application with TypeScript, Vite, and Tailwind CSS',
    'Frontend',
    '["React", "TypeScript", "Vite", "Tailwind CSS"]',
    '{
        "entry": "src/main.tsx",
        "build": "vite build",
        "dev": "vite dev",
        "port": 5173,
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "typescript": "^5.0.0",
            "@vitejs/plugin-react": "^4.0.0",
            "vite": "^5.0.0",
            "tailwindcss": "^3.3.0"
        }
    }',
    '{
        "src/main.tsx": "import React from ''react''\nimport ReactDOM from ''react-dom/client''\nimport App from ''./App.tsx''\nimport ''./index.css''\n\nReactDOM.createRoot(document.getElementById(''root'')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)",
        "src/App.tsx": "import { useState } from ''react''\nimport ''./App.css''\n\nfunction App() {\n  const [count, setCount] = useState(0)\n\n  return (\n    <div className=\"min-h-screen bg-gray-100 flex items-center justify-center\">\n      <div className=\"bg-white p-8 rounded-lg shadow-md\">\n        <h1 className=\"text-3xl font-bold text-gray-900 mb-4\">Hello MYCO!</h1>\n        <p className=\"text-gray-600 mb-6\">Welcome to your new React TypeScript project.</p>\n        <button\n          className=\"bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded\"\n          onClick={() => setCount(count + 1)}\n        >\n          Count: {count}\n        </button>\n      </div>\n    </div>\n  )\n}\n\nexport default App",
        "package.json": "{\n  \"name\": \"react-typescript-app\",\n  \"private\": true,\n  \"version\": \"0.0.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"tsc && vite build\",\n    \"lint\": \"eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\"\n  },\n  \"devDependencies\": {\n    \"@types/react\": \"^18.2.43\",\n    \"@types/react-dom\": \"^18.2.17\",\n    \"@typescript-eslint/eslint-plugin\": \"^6.14.0\",\n    \"@typescript-eslint/parser\": \"^6.14.0\",\n    \"@vitejs/plugin-react\": \"^4.2.1\",\n    \"autoprefixer\": \"^10.4.16\",\n    \"eslint\": \"^8.55.0\",\n    \"eslint-plugin-react-hooks\": \"^4.6.0\",\n    \"eslint-plugin-react-refresh\": \"^0.4.5\",\n    \"postcss\": \"^8.4.32\",\n    \"tailwindcss\": \"^3.3.6\",\n    \"typescript\": \"^5.2.2\",\n    \"vite\": \"^5.0.8\"\n  }\n}"
    }',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000002',
    'Express TypeScript API',
    'RESTful API with Express.js, TypeScript, and PostgreSQL',
    'Backend',
    '["Node.js", "Express", "TypeScript", "PostgreSQL"]',
    '{
        "entry": "src/index.ts",
        "build": "tsc",
        "dev": "ts-node src/index.ts",
        "port": 3000,
        "dependencies": {
            "express": "^4.18.0",
            "typescript": "^5.0.0",
            "ts-node": "^10.9.0",
            "@types/express": "^4.17.0",
            "pg": "^8.11.0",
            "@types/pg": "^8.10.0"
        }
    }',
    '{
        "src/index.ts": "import express from ''express'';\nimport cors from ''cors'';\nimport helmet from ''helmet'';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\n// Middleware\napp.use(cors());\napp.use(helmet());\napp.use(express.json());\n\n// Routes\napp.get(''/health'', (req, res) => {\n  res.json({ status: ''ok'', timestamp: new Date().toISOString() });\n});\n\napp.get(''/api/hello'', (req, res) => {\n  res.json({ message: ''Hello from MYCO API!'' });\n});\n\n// Start server\napp.listen(PORT, () => {\n  console.log(`Server running on port ${PORT}`);\n});",
        "package.json": "{\n  \"name\": \"express-typescript-api\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Express TypeScript API\",\n  \"main\": \"dist/index.js\",\n  \"scripts\": {\n    \"build\": \"tsc\",\n    \"start\": \"node dist/index.js\",\n    \"dev\": \"ts-node src/index.ts\",\n    \"test\": \"jest\"\n  },\n  \"dependencies\": {\n    \"express\": \"^4.18.2\",\n    \"cors\": \"^2.8.5\",\n    \"helmet\": \"^7.1.0\",\n    \"pg\": \"^8.11.3\"\n  },\n  \"devDependencies\": {\n    \"@types/express\": \"^4.17.21\",\n    \"@types/cors\": \"^2.8.17\",\n    \"@types/pg\": \"^8.10.9\",\n    \"typescript\": \"^5.3.3\",\n    \"ts-node\": \"^10.9.2\"\n  }\n}"
    }',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000003',
    'Full Stack App',
    'Complete full-stack application with React frontend and Express backend',
    'Full Stack',
    '["React", "TypeScript", "Express", "PostgreSQL", "Docker"]',
    '{
        "services": ["frontend", "backend", "database"],
        "frontend": {
            "framework": "React",
            "port": 3000
        },
        "backend": {
            "framework": "Express",
            "port": 3001
        },
        "database": {
            "type": "PostgreSQL",
            "port": 5432
        }
    }',
    '{
        "frontend/package.json": "{\n  \"name\": \"fullstack-frontend\",\n  \"private\": true,\n  \"version\": \"0.0.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"tsc && vite build\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\"\n  },\n  \"devDependencies\": {\n    \"@types/react\": \"^18.2.43\",\n    \"@types/react-dom\": \"^18.2.17\",\n    \"@vitejs/plugin-react\": \"^4.2.1\",\n    \"typescript\": \"^5.2.2\",\n    \"vite\": \"^5.0.8\"\n  }\n}",
        "backend/package.json": "{\n  \"name\": \"fullstack-backend\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Backend API for full stack app\",\n  \"main\": \"dist/index.js\",\n  \"scripts\": {\n    \"build\": \"tsc\",\n    \"start\": \"node dist/index.js\",\n    \"dev\": \"ts-node src/index.ts\"\n  },\n  \"dependencies\": {\n    \"express\": \"^4.18.2\",\n    \"cors\": \"^2.8.5\",\n    \"pg\": \"^8.11.3\"\n  },\n  \"devDependencies\": {\n    \"@types/express\": \"^4.17.21\",\n    \"@types/cors\": \"^2.8.17\",\n    \"@types/pg\": \"^8.10.9\",\n    \"typescript\": \"^5.3.3\",\n    \"ts-node\": \"^10.9.2\"\n  }\n}",
        "docker-compose.yml": "version: ''3.8''\nservices:\n  frontend:\n    build: ./frontend\n    ports:\n      - \"3000:3000\"\n    depends_on:\n      - backend\n  backend:\n    build: ./backend\n    ports:\n      - \"3001:3001\"\n    environment:\n      DATABASE_URL: postgres://postgres:password@db:5432/myapp\n    depends_on:\n      - db\n  db:\n    image: postgres:15\n    environment:\n      POSTGRES_DB: myapp\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: password\n    ports:\n      - \"5432:5432\"\n    volumes:\n      - postgres_data:/var/lib/postgresql/data\nvolumes:\n  postgres_data:"
    }',
    '00000000-0000-0000-0000-000000000001'
);

-- Insert sample demo project
INSERT INTO projects (id, name, description, slug, owner_id, organization_id, template_id, visibility, tech_stack) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'MYCO Demo Project',
    'A demonstration project showcasing the MYCO platform capabilities',
    'demo-project',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'public',
    '["React", "TypeScript", "Vite"]'
);

-- Insert sample files for demo project
INSERT INTO project_files (project_id, name, path, type, content, created_by) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'README.md',
    '/README.md',
    'file',
    '# MYCO Demo Project

Welcome to the MYCO development platform! This is a sample project that demonstrates the core features and capabilities of our AI-powered development environment.

## Features

- **AI-Powered Code Generation**: Generate complete components, functions, and even entire applications using natural language prompts
- **Real-time Collaboration**: Work together with your team in real-time, with live cursor tracking and collaborative editing
- **Integrated Development Environment**: Full-featured IDE with syntax highlighting, IntelliSense, and debugging capabilities
- **Container Execution**: Run and test your code in isolated, sandboxed containers
- **One-Click Deployment**: Deploy your applications to the cloud with a single click

## Getting Started

1. Explore the file structure in the left panel
2. Click on any file to start editing
3. Use the AI Assistant to generate new code or get help with existing code
4. Run your code using the integrated terminal
5. Deploy your project when you''re ready

## AI Assistant Commands

Try these example prompts with the AI assistant:

- "Create a React component for a user profile card"
- "Add form validation to the login component"
- "Generate unit tests for the utility functions"
- "Optimize this code for better performance"
- "Add error handling to the API calls"

## Support

If you need help or have questions, please visit our documentation or contact support.

Happy coding! 🚀
',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    'src',
    '/src',
    'directory',
    NULL,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    'App.tsx',
    '/src/App.tsx',
    'file',
    'import { useState } from ''react''
import ''./App.css''

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
          Welcome to MYCO! 🚀
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Your AI-powered development platform is ready to use.
        </p>
        
        <div className="space-y-4">
          <div className="text-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              onClick={() => setCount(count + 1)}
            >
              Click Count: {count}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <h3 className="font-semibold text-gray-800">AI Assistant</h3>
              <p className="text-sm text-gray-600">Get code suggestions and help</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <h3 className="font-semibold text-gray-800">Live Collaboration</h3>
              <p className="text-sm text-gray-600">Work with your team in real-time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    'package.json',
    '/package.json',
    'file',
    '{
  "name": "myco-demo-project",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}',
    '00000000-0000-0000-0000-000000000001'
);

COMMIT;