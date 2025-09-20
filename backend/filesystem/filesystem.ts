import { api, APIError } from "encore.dev/api";
import type { FileNode, CreateFileRequest, UpdateFileRequest, FileListResponse, WriteFileRequest, CreateDirectoryRequest } from "./types";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface FileRow {
  id: string;
  project_id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  parent_id: string | null;
  content: string | null;
  size: number;
  created_at: Date;
  updated_at: Date;
}

// Lists all files in a project as a hierarchical tree structure.
export const listFilesAPI = api(
  { expose: true, method: "GET", path: "/filesystem/:projectId", auth: true },
  async ({ projectId }: { projectId: string }): Promise<FileListResponse> => {
    if (!projectId || typeof projectId !== 'string') {
      throw APIError.invalidArgument("Valid project ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user has access to this project
    const projectAccess = await db.queryRow`
      SELECT p.id FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${projectId} 
      AND (p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID})
    `;

    if (!projectAccess) {
      throw APIError.permissionDenied("Access denied to this project");
    }

    const files = await db.queryAll<FileRow>`
      SELECT id::text, project_id::text, name, path, type, parent_id::text, content, size, created_at, updated_at
      FROM files 
      WHERE project_id = ${projectId}
      ORDER BY type DESC, name ASC
    `;

    // Build hierarchical structure
    const fileMap = new Map<string, FileNode>();
    const rootFiles: FileNode[] = [];

    // First pass: create all file nodes
    for (const file of files) {
      const fileNode: FileNode = {
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        content: file.content || undefined,
        size: file.size,
        lastModified: file.updated_at,
        children: file.type === 'directory' ? [] : undefined
      };
      fileMap.set(file.id, fileNode);
    }

    // Second pass: build hierarchy
    for (const file of files) {
      const fileNode = fileMap.get(file.id)!;
      if (file.parent_id) {
        const parent = fileMap.get(file.parent_id);
        if (parent && parent.children) {
          parent.children.push(fileNode);
        }
      } else {
        rootFiles.push(fileNode);
      }
    }

    return { files: rootFiles };
  }
);

// Gets a specific file by ID.
export const getFileAPI = api(
  { expose: true, method: "GET", path: "/filesystem/file/:id", auth: true },
  async ({ id }: { id: string }): Promise<FileNode> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid file ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    const file = await db.queryRow<FileRow & { project_owner_id: string }>`
      SELECT f.id::text, f.project_id::text, f.name, f.path, f.type, f.parent_id::text, 
             f.content, f.size, f.created_at, f.updated_at, p.owner_id as project_owner_id
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.id = ${id}
      AND (p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID})
    `;

    if (!file) {
      throw APIError.notFound("File not found or access denied");
    }

    return {
      id: file.id,
      name: file.name,
      path: file.path,
      type: file.type,
      content: file.content || undefined,
      size: file.size,
      lastModified: file.updated_at,
    };
  }
);

// Creates a new file or directory.
export const createFileAPI = api(
  { expose: true, method: "POST", path: "/filesystem/file", auth: true },
  async (req: CreateFileRequest): Promise<FileNode> => {
    if (!req.projectId || !req.path || !req.type) {
      throw APIError.invalidArgument("Project ID, path, and type are required");
    }

    if (!['file', 'directory'].includes(req.type)) {
      throw APIError.invalidArgument("Type must be 'file' or 'directory'");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user has write access to project
    const projectAccess = await db.queryRow`
      SELECT p.id FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId} 
      AND (p.owner_id = ${auth.userID} OR (pc.user_id = ${auth.userID} AND pc.role IN ('owner', 'editor')))
    `;

    if (!projectAccess) {
      throw APIError.permissionDenied("Write access denied to this project");
    }

    // Check if file already exists
    const existing = await db.queryRow`
      SELECT id FROM files WHERE project_id = ${req.projectId} AND path = ${req.path}
    `;

    if (existing) {
      throw APIError.alreadyExists("File already exists at this path");
    }

    const name = req.path.split('/').pop() || 'untitled';
    const content = req.content || (req.type === 'file' ? '' : null);
    const size = content ? content.length : 0;

    // Find parent directory if path contains directories
    let parentId: string | null = null;
    const pathParts = req.path.split('/').filter(p => p);
    if (pathParts.length > 1) {
      const parentPath = '/' + pathParts.slice(0, -1).join('/');
      const parent = await db.queryRow`
        SELECT id FROM files 
        WHERE project_id = ${req.projectId} AND path = ${parentPath} AND type = 'directory'
      `;
      if (parent) {
        parentId = parent.id;
      }
    }

    const result = await db.queryRow<{ id: string }>`
      INSERT INTO files (project_id, name, path, type, parent_id, content, size)
      VALUES (${req.projectId}, ${name}, ${req.path}, ${req.type}, ${parentId}, ${content}, ${size})
      RETURNING id::text
    `;

    if (!result) {
      throw APIError.internal("Failed to create file");
    }

    return {
      id: result.id,
      name,
      path: req.path,
      type: req.type,
      content: req.type === 'file' ? content || undefined : undefined,
      size,
      lastModified: new Date(),
    };
  }
);

// Updates an existing file's content or metadata.
export const updateFileAPI = api(
  { expose: true, method: "PUT", path: "/filesystem/file/:id", auth: true },
  async ({ id, ...req }: UpdateFileRequest & { id: string }): Promise<FileNode> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid file ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user has write access to the file
    const file = await db.queryRow<FileRow & { project_owner_id: string }>`
      SELECT f.*, p.owner_id as project_owner_id
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.id = ${id}
      AND (p.owner_id = ${auth.userID} OR (pc.user_id = ${auth.userID} AND pc.role IN ('owner', 'editor')))
    `;

    if (!file) {
      throw APIError.notFound("File not found or write access denied");
    }

    if (file.type !== 'file') {
      throw APIError.invalidArgument("Cannot update content of directory");
    }

    if (req.content === undefined) {
      throw APIError.invalidArgument("Content is required for file updates");
    }

    const size = req.content.length;

    await db.exec`
      UPDATE files 
      SET content = ${req.content}, size = ${size}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return {
      id: file.id,
      name: file.name,
      path: file.path,
      type: file.type,
      content: req.content,
      size,
      lastModified: new Date(),
    };
  }
);

// Deletes a file or directory and all its children.
export const deleteFileAPI = api(
  { expose: true, method: "DELETE", path: "/filesystem/file/:id", auth: true },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    if (!id || typeof id !== 'string') {
      throw APIError.invalidArgument("Valid file ID is required");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Verify user has write access to the file
    const file = await db.queryRow`
      SELECT f.id, f.type
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.id = ${id}
      AND (p.owner_id = ${auth.userID} OR (pc.user_id = ${auth.userID} AND pc.role IN ('owner', 'editor')))
    `;

    if (!file) {
      throw APIError.notFound("File not found or write access denied");
    }

    // Use a transaction to ensure consistency when deleting directories
    await using tx = await db.begin();

    try {
      // Delete recursively if it's a directory (CASCADE will handle children)
      await tx.exec`DELETE FROM files WHERE id = ${id}`;
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw APIError.internal("Failed to delete file");
    }

    return { success: true };
  }
);

// Legacy function versions that match test signatures
export function readFile(fileId: string, _unusedParam?: any): Promise<FileNode> {
  return getFileAPI({ id: fileId });
}

export function writeFile(fileId: string, req: WriteFileRequest): Promise<FileNode> {
  return updateFileAPI({ id: fileId, content: req.content });  
}

export function createDirectory(projectId: string, req: CreateDirectoryRequest): Promise<FileNode> {
  return createFileAPI({ projectId: req.projectId, path: req.path, type: 'directory' });
}

export function listFiles(projectId: string, _path?: string): Promise<FileListResponse> {
  return listFilesAPI({ projectId });
}

// For API access, export the API functions with their original names
export const getFile = getFileAPI;
export const updateFile = updateFileAPI;
export const createFile = createFileAPI;
export const deleteFile = deleteFileAPI;