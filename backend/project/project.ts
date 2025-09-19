import { api } from "encore.dev/api";
import type { Project, CreateProjectRequest, UpdateProjectRequest } from "./types";

export const list = api(
  { expose: true, method: "GET", path: "/projects" },
  async (): Promise<{ projects: Project[] }> => {
    // Mock data for now
    return {
      projects: [
        {
          id: "1",
          name: "Sample Project",
          description: "A sample project",
          template: "react-typescript",
          templateType: "web",
          templateName: "React TypeScript",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]
    };
  }
);

export const create = api(
  { expose: true, method: "POST", path: "/projects" },
  async (req: CreateProjectRequest): Promise<Project> => {
    // Mock implementation
    return {
      id: Date.now().toString(),
      name: req.name,
      description: req.description,
      template: req.template,
      templateType: "web",
      templateName: req.template || "React TypeScript",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
);

export const get = api(
  { expose: true, method: "GET", path: "/projects/:id" },
  async ({ id }: { id: string }): Promise<Project> => {
    // Mock implementation
    return {
      id,
      name: "Sample Project",
      description: "A sample project",
      template: "react-typescript",
      templateType: "web",
      templateName: "React TypeScript",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
);

export const update = api(
  { expose: true, method: "PUT", path: "/projects/:id" },
  async ({ id, ...req }: UpdateProjectRequest & { id: string }): Promise<Project> => {
    // Mock implementation
    return {
      id,
      name: req.name || "Updated Project",
      description: req.description,
      templateType: "web",
      templateName: "React TypeScript",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
);

export const remove = api(
  { expose: true, method: "DELETE", path: "/projects/:id" },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    // Mock implementation
    return { success: true };
  }
);