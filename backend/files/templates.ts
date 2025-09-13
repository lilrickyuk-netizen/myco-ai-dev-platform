import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Template } from "./types";

export interface ListTemplatesResponse {
  templates: Template[];
}

// Lists all available project templates.
export const listTemplates = api<void, ListTemplatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/files/templates" },
  async () => {
    return {
      templates: [
        {
          type: "web",
          name: "react-typescript",
          displayName: "React + TypeScript",
          description: "Modern React application with TypeScript and Tailwind CSS",
          icon: "react",
          tags: ["react", "typescript", "tailwind", "vite"],
          framework: "react",
          language: "typescript",
          features: [
            "Hot Module Replacement",
            "TypeScript Support",
            "Tailwind CSS",
            "Component Library Ready",
            "Testing Setup"
          ]
        },
        {
          type: "web",
          name: "nextjs-typescript", 
          displayName: "Next.js + TypeScript",
          description: "Full-stack React framework with SSR and TypeScript",
          icon: "nextjs",
          tags: ["nextjs", "react", "typescript", "ssr"],
          framework: "nextjs",
          language: "typescript",
          features: [
            "Server-Side Rendering",
            "API Routes",
            "File-based Routing",
            "Image Optimization",
            "TypeScript Support"
          ]
        },
        {
          type: "backend",
          name: "express-typescript",
          displayName: "Express + TypeScript API",
          description: "RESTful API server with Express and TypeScript",
          icon: "nodejs",
          tags: ["express", "typescript", "api", "rest"],
          framework: "express",
          language: "typescript",
          features: [
            "RESTful API Structure",
            "TypeScript Support",
            "Middleware Setup",
            "Error Handling",
            "Security Headers"
          ]
        },
        {
          type: "backend",
          name: "fastapi-python",
          displayName: "FastAPI + Python",
          description: "High-performance API with automatic OpenAPI documentation",
          icon: "python",
          tags: ["fastapi", "python", "api", "async"],
          framework: "fastapi",
          language: "python",
          features: [
            "Automatic OpenAPI Docs",
            "Type Hints",
            "Async Support", 
            "Dependency Injection",
            "Built-in Validation"
          ]
        },
        {
          type: "mobile",
          name: "react-native-typescript",
          displayName: "React Native + TypeScript",
          description: "Cross-platform mobile app with React Native",
          icon: "mobile",
          tags: ["react-native", "typescript", "mobile", "ios", "android"],
          framework: "react-native",
          language: "typescript",
          features: [
            "Cross-platform",
            "Navigation Setup",
            "TypeScript Support",
            "Component Library",
            "Development Tools"
          ]
        },
        {
          type: "data",
          name: "data-pipeline-python",
          displayName: "Data Pipeline + Python",
          description: "ETL pipeline with pandas and data processing tools",
          icon: "database",
          tags: ["python", "pandas", "etl", "data"],
          framework: "pandas",
          language: "python",
          features: [
            "Data Processing",
            "ETL Pipeline",
            "Pandas Integration",
            "Data Validation",
            "Scheduling Support"
          ]
        }
      ]
    };
  }
);