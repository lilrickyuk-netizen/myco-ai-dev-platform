import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework?: string;
  files: TemplateFile[];
  dependencies?: string[];
  scripts?: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
  contentType: string;
}

interface GetTemplatesResponse {
  templates: Template[];
}

// Gets all available project templates.
export const getTemplates = api<void, GetTemplatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/ai/templates" },
  async () => {
    const auth = getAuthData()!;
    
    return {
      templates: [
        {
          id: "react-typescript",
          name: "React + TypeScript",
          description: "Modern React application with TypeScript, Vite, and Tailwind CSS",
          category: "Frontend",
          language: "TypeScript",
          framework: "React",
          files: [
            {
              path: "src/App.tsx",
              content: getReactAppTemplate(),
              contentType: "text/typescript",
            },
            {
              path: "src/main.tsx",
              content: getReactMainTemplate(),
              contentType: "text/typescript",
            },
            {
              path: "index.html",
              content: getReactIndexTemplate(),
              contentType: "text/html",
            },
            {
              path: "src/index.css",
              content: getReactCSSTemplate(),
              contentType: "text/css",
            },
          ],
          dependencies: [
            "react",
            "react-dom",
            "@types/react",
            "@types/react-dom",
            "typescript",
            "vite",
            "@vitejs/plugin-react",
            "tailwindcss",
            "autoprefixer",
            "postcss",
          ],
          scripts: {
            "dev": "vite",
            "build": "tsc && vite build",
            "preview": "vite preview",
          },
        },
        {
          id: "nodejs-express",
          name: "Node.js + Express",
          description: "RESTful API server with Express.js and TypeScript",
          category: "Backend",
          language: "TypeScript",
          framework: "Express",
          files: [
            {
              path: "src/index.ts",
              content: getExpressIndexTemplate(),
              contentType: "text/typescript",
            },
            {
              path: "src/routes/api.ts",
              content: getExpressRoutesTemplate(),
              contentType: "text/typescript",
            },
          ],
          dependencies: [
            "express",
            "@types/express",
            "typescript",
            "ts-node",
            "nodemon",
            "cors",
            "@types/cors",
          ],
          scripts: {
            "dev": "nodemon src/index.ts",
            "build": "tsc",
            "start": "node dist/index.js",
          },
        },
        {
          id: "nextjs-typescript",
          name: "Next.js + TypeScript",
          description: "Full-stack React application with Next.js and TypeScript",
          category: "Full-stack",
          language: "TypeScript",
          framework: "Next.js",
          files: [
            {
              path: "pages/index.tsx",
              content: getNextjsIndexTemplate(),
              contentType: "text/typescript",
            },
            {
              path: "pages/api/hello.ts",
              content: getNextjsAPITemplate(),
              contentType: "text/typescript",
            },
          ],
          dependencies: [
            "next",
            "react",
            "react-dom",
            "@types/react",
            "@types/react-dom",
            "typescript",
          ],
          scripts: {
            "dev": "next dev",
            "build": "next build",
            "start": "next start",
          },
        },
      ],
    };
  }
);

function getReactAppTemplate(): string {
  return `import React from 'react';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to React + TypeScript
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your project is ready to go!
        </p>
        <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
          Get Started
        </button>
      </div>
    </div>
  );
}

export default App;`;
}

function getReactMainTemplate(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

function getReactIndexTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + TypeScript App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function getReactCSSTemplate(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`;
}

function getExpressIndexTemplate(): string {
  return `import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Express + TypeScript API' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;
}

function getExpressRoutesTemplate(): string {
  return `import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ]);
});

export default router;`;
}

function getNextjsIndexTemplate(): string {
  return `import type { NextPage } from 'next';
import Head from 'next/head';

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Next.js + TypeScript App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Next.js + TypeScript
          </h1>
          <p className="text-lg text-gray-600">
            Your full-stack application is ready!
          </p>
        </div>
      </main>
    </div>
  );
};

export default Home;`;
}

function getNextjsAPITemplate(): string {
  return `import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  message: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).json({ message: 'Hello from Next.js API!' });
}`;
}
