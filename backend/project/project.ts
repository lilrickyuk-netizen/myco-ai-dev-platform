import { api, APIError } from "encore.dev/api";
import type { Project, CreateProjectRequest, UpdateProjectRequest } from "./types";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  template_type: string | null;
  repository_url: string | null;
  status: string;
  visibility: string;
  created_at: Date;
  updated_at: Date;
}

// Lists all projects accessible to the authenticated user.
export const list = api(
  { expose: true, method: "GET", path: "/projects", auth: true },
  async (): Promise<{ projects: Project[] }> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Ensure user exists in database
    await db.exec`
      INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url)
      VALUES (${auth.userID}, ${auth.userID}, ${auth.email || ''}, ${auth.firstName || ''}, ${auth.lastName || ''}, ${auth.imageUrl})
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `;

    const projects = await db.queryAll<ProjectRow>`
      SELECT DISTINCT p.id::text, p.name, p.description, p.owner_id, p.template_type, p.repository_url, p.status, p.visibility, p.created_at, p.updated_at
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID}
      ORDER BY p.updated_at DESC
    `;

    const projectList: Project[] = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      template: p.template_type || undefined,
      templateType: p.template_type || "web",
      templateName: getTemplateName(p.template_type),
      status: p.status as "active" | "archived" | "deleted",
      createdAt: p.created_at.toISOString(),
      updatedAt: p.updated_at.toISOString(),
      repositoryUrl: p.repository_url || undefined,
      visibility: p.visibility as "private" | "public",
      isOwner: p.owner_id === auth.userID
    }));

    return { projects: projectList };
  }
);

function getTemplateName(templateType: string | null): string {
  switch (templateType) {
    case 'react-typescript': return 'React TypeScript';
    case 'react-javascript': return 'React JavaScript';
    case 'next-typescript': return 'Next.js TypeScript';
    case 'vue-typescript': return 'Vue.js TypeScript';
    case 'angular-typescript': return 'Angular TypeScript';
    case 'express-typescript': return 'Express TypeScript';
    case 'fastify-typescript': return 'Fastify TypeScript';
    default: return 'Custom Template';
  }
}

// Creates a new project for the authenticated user.
export const create = api(
  { expose: true, method: "POST", path: "/projects", auth: true },
  async (req: CreateProjectRequest): Promise<Project> => {
    if (!req.name || typeof req.name !== 'string' || req.name.trim().length === 0) {
      throw APIError.invalidArgument("Project name is required");
    }

    if (req.name.length > 100) {
      throw APIError.invalidArgument("Project name too long (max 100 characters)");
    }

    if (req.description && req.description.length > 500) {
      throw APIError.invalidArgument("Project description too long (max 500 characters)");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Ensure user exists in database
    await db.exec`
      INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url)
      VALUES (${auth.userID}, ${auth.userID}, ${auth.email || ''}, ${auth.firstName || ''}, ${auth.lastName || ''}, ${auth.imageUrl})
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `;

    const templateType = req.template || 'react-typescript';
    const visibility = req.visibility || 'private';

    const result = await db.queryRow<{ id: string }>`
      INSERT INTO projects (name, description, owner_id, template_type, status, visibility)
      VALUES (${req.name.trim()}, ${req.description?.trim() || null}, ${auth.userID}, ${templateType}, 'active', ${visibility})
      RETURNING id::text
    `;

    if (!result) {
      throw APIError.internal("Failed to create project");
    }

    // Create initial project structure
    await createInitialProjectStructure(result.id, templateType);

    return {
      id: result.id,
      name: req.name.trim(),
      description: req.description?.trim(),
      template: templateType,
      templateType: "web",
      templateName: getTemplateName(templateType),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visibility,
      isOwner: true
    };
  }
);

async function createInitialProjectStructure(projectId: string, templateType: string) {
  const baseFiles = [
    { path: '/src', type: 'directory', content: null },
    { path: '/public', type: 'directory', content: null },
    { path: '/README.md', type: 'file', content: '# My Project\n\nProject created with MYCO AI Dev Platform.' },
  ];

  if (templateType === 'react-typescript') {
    baseFiles.push(
      { path: '/src/App.tsx', type: 'file', content: 'import React from \'react\';\n\nfunction App() {\n  return (\n    <div className="App">\n      <h1>Hello World</h1>\n    </div>\n  );\n}\n\nexport default App;' },
      { path: '/src/index.tsx', type: 'file', content: 'import React from \'react\';\nimport ReactDOM from \'react-dom/client\';\nimport App from \'./App\';\n\nconst root = ReactDOM.createRoot(document.getElementById(\'root\')!);\nroot.render(<App />);' },
      { path: '/package.json', type: 'file', content: JSON.stringify({
        name: 'my-project',
        version: '0.1.0',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'typescript': '^5.0.0'
        }
      }, null, 2) }
    );
  }

  for (const file of baseFiles) {
    await db.exec`
      INSERT INTO files (project_id, name, path, type, content, size)
      VALUES (${projectId}, ${file.path.split('/').pop()}, ${file.path}, ${file.type}, ${file.content}, ${file.content?.length || 0})
    `;
  }
}

// Gets a specific project by ID.
export const get = api(
  { expose: true, method: "GET", path: "/projects/:id", auth: true },
  async ({ id }: { id: string }): Promise<Project> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid project ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    const project = await db.queryRow<ProjectRow>`
      SELECT p.id::text, p.name, p.description, p.owner_id, p.template_type, p.repository_url, p.status, p.visibility, p.created_at, p.updated_at
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${id}
      AND (p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID})
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      template: project.template_type || undefined,
      templateType: project.template_type || "web",
      templateName: getTemplateName(project.template_type),
      status: project.status as "active" | "archived" | "deleted",
      createdAt: project.created_at.toISOString(),
      updatedAt: project.updated_at.toISOString(),
      repositoryUrl: project.repository_url || undefined,
      visibility: project.visibility as "private" | "public",
      isOwner: project.owner_id === auth.userID
    };
  }
);

// Updates an existing project.
export const update = api(
  { expose: true, method: "PUT", path: "/projects/:id", auth: true },
  async ({ id, ...req }: UpdateProjectRequest & { id: string }): Promise<Project> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid project ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user has edit access to the project
    const project = await db.queryRow<ProjectRow>`
      SELECT p.id::text, p.name, p.description, p.owner_id, p.template_type, p.repository_url, p.status, p.visibility, p.created_at, p.updated_at
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${id}
      AND (p.owner_id = ${auth.userID} OR (pc.user_id = ${auth.userID} AND pc.role IN ('owner', 'editor')))
    `;

    if (!project) {
      throw APIError.notFound("Project not found or edit access denied");
    }

    // Validate updates
    if (req.name !== undefined) {
      if (!req.name || typeof req.name !== 'string' || req.name.trim().length === 0) {
        throw APIError.invalidArgument("Project name cannot be empty");
      }
      if (req.name.length > 100) {
        throw APIError.invalidArgument("Project name too long (max 100 characters)");
      }
    }

    if (req.description !== undefined && req.description && req.description.length > 500) {
      throw APIError.invalidArgument("Project description too long (max 500 characters)");
    }

    // Only project owner can change visibility
    if (req.visibility !== undefined && project.owner_id !== auth.userID) {
      throw APIError.permissionDenied("Only project owner can change visibility");
    }

    const updates: Array<{ field: string; value: any }> = [];
    if (req.name !== undefined) updates.push({ field: 'name', value: req.name.trim() });
    if (req.description !== undefined) updates.push({ field: 'description', value: req.description?.trim() || null });
    if (req.visibility !== undefined) updates.push({ field: 'visibility', value: req.visibility });
    if (req.status !== undefined) updates.push({ field: 'status', value: req.status });
    if (req.repositoryUrl !== undefined) updates.push({ field: 'repository_url', value: req.repositoryUrl || null });

    if (updates.length > 0) {
      const setClauses = updates.map((u, i) => `${u.field} = $${i + 2}`).join(', ');
      const values = [id, ...updates.map(u => u.value)];
      
      await db.rawExec(`UPDATE projects SET ${setClauses}, updated_at = NOW() WHERE id = $1`, ...values);
    }

    // Return updated project
    const updatedProject = await db.queryRow<ProjectRow>`
      SELECT id::text, name, description, owner_id, template_type, repository_url, status, visibility, created_at, updated_at
      FROM projects
      WHERE id = ${id}
    `;

    if (!updatedProject) {
      throw APIError.internal("Failed to retrieve updated project");
    }

    return {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description || undefined,
      template: updatedProject.template_type || undefined,
      templateType: updatedProject.template_type || "web",
      templateName: getTemplateName(updatedProject.template_type),
      status: updatedProject.status as "active" | "archived" | "deleted",
      createdAt: updatedProject.created_at.toISOString(),
      updatedAt: updatedProject.updated_at.toISOString(),
      repositoryUrl: updatedProject.repository_url || undefined,
      visibility: updatedProject.visibility as "private" | "public",
      isOwner: updatedProject.owner_id === auth.userID
    };
  }
);

// Deletes a project (only accessible to project owner).
export const remove = api(
  { expose: true, method: "DELETE", path: "/projects/:id", auth: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid project ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user is the project owner
    const project = await db.queryRow`
      SELECT id, owner_id FROM projects
      WHERE id = ${id} AND owner_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or not authorized to delete");
    }

    // Use transaction to ensure consistency
    await using tx = await db.begin();

    try {
      // Soft delete - mark as deleted instead of hard delete
      await tx.exec`
        UPDATE projects 
        SET status = 'deleted', updated_at = NOW()
        WHERE id = ${id}
      `;
      
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw APIError.internal("Failed to delete project");
    }

    return { success: true };
  }
);