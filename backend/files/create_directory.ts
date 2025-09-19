import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { filesDB } from "./db";
import { File } from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface CreateDirectoryRequest {
  projectId: string;
  path: string;
  name: string;
  parentId?: string;
}

export const createDirectory = api<CreateDirectoryRequest, File>(
  { auth: true, expose: true, method: "POST", path: "/files/directories" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.name || !req.path) {
      throw APIError.invalidArgument("Project ID, name, and path are required");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or access denied");
    }

    // Validate directory name
    if (req.name.includes('/') || req.name.includes('\\') || req.name.trim() === '') {
      throw APIError.invalidArgument("Invalid directory name");
    }

    // Normalize path
    let fullPath = req.path;
    if (!fullPath.startsWith('/')) {
      fullPath = '/' + fullPath;
    }
    if (!fullPath.endsWith('/')) {
      fullPath = fullPath + '/';
    }
    fullPath = fullPath + req.name;

    // Check if directory already exists
    const existing = await filesDB.queryRow`
      SELECT id FROM files 
      WHERE project_id = ${req.projectId} 
      AND path = ${fullPath}
      AND is_directory = true
    `;

    if (existing) {
      throw APIError.alreadyExists("Directory already exists at this path");
    }

    // Verify parent directory exists if parentId is provided
    if (req.parentId) {
      const parent = await filesDB.queryRow`
        SELECT id, path FROM files 
        WHERE id = ${req.parentId} 
        AND project_id = ${req.projectId}
        AND is_directory = true
      `;

      if (!parent) {
        throw APIError.notFound("Parent directory not found");
      }

      // Verify the path is consistent with parent
      if (!fullPath.startsWith(parent.path + '/')) {
        throw APIError.invalidArgument("Path is not consistent with parent directory");
      }
    }

    // Create directory metadata
    const directory = await filesDB.queryRow<{
      id: string;
      project_id: string;
      name: string;
      path: string;
      content: string | null;
      mime_type: string | null;
      size_bytes: number;
      is_directory: boolean;
      parent_id: string | null;
      user_id: string;
      created_at: Date;
      updated_at: Date;
    }>`
      INSERT INTO files (
        project_id, 
        name, 
        path, 
        is_directory, 
        parent_id, 
        user_id, 
        size_bytes
      )
      VALUES (
        ${req.projectId}, 
        ${req.name}, 
        ${fullPath}, 
        true, 
        ${req.parentId || null}, 
        ${auth.userID}, 
        0
      )
      RETURNING 
        id,
        project_id,
        name,
        path,
        content,
        mime_type,
        size_bytes,
        is_directory,
        parent_id,
        user_id,
        created_at,
        updated_at
    `;

    if (!directory) {
      throw APIError.internal("Failed to create directory");
    }

    return {
      id: directory.id,
      projectId: directory.project_id,
      name: directory.name,
      path: directory.path,
      content: directory.content,
      mimeType: directory.mime_type,
      sizeBytes: directory.size_bytes,
      isDirectory: directory.is_directory,
      parentId: directory.parent_id,
      userId: directory.user_id,
      createdAt: directory.created_at,
      updatedAt: directory.updated_at
    };
  }
);

export const createPath = api<{
  projectId: string;
  path: string;
}, { directories: File[]; success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/files/directories/path" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.path) {
      throw APIError.invalidArgument("Project ID and path are required");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or access denied");
    }

    // Normalize and split path
    let normalizedPath = req.path.trim();
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    
    const pathParts = normalizedPath.split('/').filter(part => part.trim() !== '');
    const createdDirectories: File[] = [];

    let currentPath = '';
    let parentId: string | null = null;

    for (const part of pathParts) {
      currentPath += '/' + part;

      // Check if directory already exists
      const existing = await filesDB.queryRow<{ id: string }>`
        SELECT id FROM files 
        WHERE project_id = ${req.projectId} 
        AND path = ${currentPath}
        AND is_directory = true
      `;

      if (existing) {
        parentId = existing.id;
        continue;
      }

      // Create directory
      const directory = await filesDB.queryRow<{
        id: string;
        project_id: string;
        name: string;
        path: string;
        content: string | null;
        mime_type: string | null;
        size_bytes: number;
        is_directory: boolean;
        parent_id: string | null;
        user_id: string;
        created_at: Date;
        updated_at: Date;
      }>`
        INSERT INTO files (
          project_id, 
          name, 
          path, 
          is_directory, 
          parent_id, 
          user_id, 
          size_bytes
        )
        VALUES (
          ${req.projectId}, 
          ${part}, 
          ${currentPath}, 
          true, 
          ${parentId}, 
          ${auth.userID}, 
          0
        )
        RETURNING 
          id,
          project_id,
          name,
          path,
          content,
          mime_type,
          size_bytes,
          is_directory,
          parent_id,
          user_id,
          created_at,
          updated_at
      `;

      if (!directory) {
        throw APIError.internal(`Failed to create directory: ${part}`);
      }

      createdDirectories.push({
        id: directory.id,
        projectId: directory.project_id,
        name: directory.name,
        path: directory.path,
        content: directory.content,
        mimeType: directory.mime_type,
        sizeBytes: directory.size_bytes,
        isDirectory: directory.is_directory,
        parentId: directory.parent_id,
        userId: directory.user_id,
        createdAt: directory.created_at,
        updatedAt: directory.updated_at
      });

      parentId = directory.id;
    }

    return {
      directories: createdDirectories,
      success: true
    };
  }
);