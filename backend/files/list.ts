import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { filesDB } from "./db";
import { File, FileTree } from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface ListFilesRequest {
  projectId: string;
  parentId?: string;
  path?: string;
  includeContent?: boolean;
  recursive?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchFilesRequest {
  projectId: string;
  query: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
}

export const listFiles = api<ListFilesRequest, {
  files: File[];
  total: number;
  hasMore: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/files" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
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

    const limit = Math.min(req.limit || 100, 500);
    const offset = req.offset || 0;

    let whereConditions = ["f.project_id = $1"];
    const params: any[] = [req.projectId];
    let paramIndex = 2;

    // Filter by parent directory
    if (req.parentId) {
      whereConditions.push(`f.parent_id = $${paramIndex++}`);
      params.push(req.parentId);
    } else if (req.parentId === null) {
      whereConditions.push("f.parent_id IS NULL");
    }

    // Filter by path prefix
    if (req.path) {
      let normalizedPath = req.path;
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
      }
      if (!normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath + '/';
      }
      
      if (req.recursive) {
        whereConditions.push(`f.path LIKE $${paramIndex++}`);
        params.push(normalizedPath + '%');
      } else {
        whereConditions.push(`f.path LIKE $${paramIndex++} AND f.path NOT LIKE $${paramIndex++}`);
        params.push(normalizedPath + '%');
        params.push(normalizedPath + '%/%');
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM files f
      WHERE ${whereClause}
    `;
    const countResult = await filesDB.queryRow<{ count: number }>(countQuery, ...params);
    const total = countResult?.count || 0;

    // Get files with pagination
    const filesQuery = `
      SELECT 
        f.id,
        f.project_id,
        f.name,
        f.path,
        ${req.includeContent ? 'f.content,' : 'NULL as content,'}
        f.mime_type,
        f.size_bytes,
        f.is_directory,
        f.parent_id,
        f.user_id,
        f.created_at,
        f.updated_at
      FROM files f
      WHERE ${whereClause}
      ORDER BY f.is_directory DESC, f.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const files = await filesDB.query<{
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
    }>(filesQuery, ...params);

    return {
      files: files.map(file => ({
        id: file.id,
        projectId: file.project_id,
        name: file.name,
        path: file.path,
        content: file.content,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        isDirectory: file.is_directory,
        parentId: file.parent_id,
        userId: file.user_id,
        createdAt: file.created_at,
        updatedAt: file.updated_at
      })),
      total,
      hasMore: offset + files.length < total
    };
  }
);

export const getFileTree = api<{
  projectId: string;
  rootPath?: string;
  maxDepth?: number;
  includeContent?: boolean;
}, FileTree[]>(
  { auth: true, expose: true, method: "GET", path: "/files/tree" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
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

    const rootPath = req.rootPath || '/';
    const maxDepth = req.maxDepth || 10;

    // Get all files in the project that match the root path
    const files = await filesDB.query<{
      id: string;
      name: string;
      path: string;
      content: string | null;
      mime_type: string | null;
      size_bytes: number;
      is_directory: boolean;
      parent_id: string | null;
      updated_at: Date;
    }>`
      SELECT 
        id,
        name,
        path,
        ${req.includeContent ? 'content,' : 'NULL as content,'}
        mime_type,
        size_bytes,
        is_directory,
        parent_id,
        updated_at
      FROM files
      WHERE project_id = ${req.projectId}
      AND path LIKE ${rootPath === '/' ? '%' : rootPath + '%'}
      ORDER BY path ASC
    `;

    // Build tree structure
    const fileMap = new Map<string, FileTree>();
    const rootItems: FileTree[] = [];

    // First pass: create all file nodes
    for (const file of files) {
      const node: FileTree = {
        id: file.id,
        name: file.name,
        path: file.path,
        isDirectory: file.is_directory,
        children: file.is_directory ? [] : undefined,
        content: file.content,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        updatedAt: file.updated_at
      };
      fileMap.set(file.id, node);
    }

    // Second pass: build parent-child relationships
    for (const file of files) {
      const node = fileMap.get(file.id)!;
      
      if (file.parent_id && fileMap.has(file.parent_id)) {
        const parent = fileMap.get(file.parent_id)!;
        if (parent.children) {
          parent.children.push(node);
        }
      } else if (!file.parent_id || file.path === rootPath) {
        // Root level items
        rootItems.push(node);
      }
    }

    // Sort children in each directory
    function sortChildren(node: FileTree) {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    }

    rootItems.forEach(sortChildren);

    return rootItems;
  }
);

export const searchFiles = api<SearchFilesRequest, {
  files: File[];
  total: number;
  hasMore: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/files/search" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.query) {
      throw APIError.invalidArgument("Project ID and search query are required");
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

    const limit = Math.min(req.limit || 50, 200);
    const offset = req.offset || 0;

    let whereConditions = [
      "f.project_id = $1",
      "(f.name ILIKE $2 OR f.path ILIKE $2 OR f.content ILIKE $2)"
    ];
    const params: any[] = [req.projectId, `%${req.query}%`];
    let paramIndex = 3;

    if (req.mimeType) {
      whereConditions.push(`f.mime_type = $${paramIndex++}`);
      params.push(req.mimeType);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM files f
      WHERE ${whereClause}
    `;
    const countResult = await filesDB.queryRow<{ count: number }>(countQuery, ...params);
    const total = countResult?.count || 0;

    // Get files with pagination, ranked by relevance
    const filesQuery = `
      SELECT 
        f.id,
        f.project_id,
        f.name,
        f.path,
        f.content,
        f.mime_type,
        f.size_bytes,
        f.is_directory,
        f.parent_id,
        f.user_id,
        f.created_at,
        f.updated_at,
        CASE 
          WHEN f.name ILIKE $2 THEN 3
          WHEN f.path ILIKE $2 THEN 2
          WHEN f.content ILIKE $2 THEN 1
          ELSE 0
        END as relevance_score
      FROM files f
      WHERE ${whereClause}
      ORDER BY relevance_score DESC, f.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const files = await filesDB.query<{
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
    }>(filesQuery, ...params);

    return {
      files: files.map(file => ({
        id: file.id,
        projectId: file.project_id,
        name: file.name,
        path: file.path,
        content: file.content,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        isDirectory: file.is_directory,
        parentId: file.parent_id,
        userId: file.user_id,
        createdAt: file.created_at,
        updatedAt: file.updated_at
      })),
      total,
      hasMore: offset + files.length < total
    };
  }
);

export const getFileStats = api<{ projectId: string }, {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  filesByType: Array<{ mimeType: string; count: number; totalSize: number }>;
}>(
  { auth: true, expose: true, method: "GET", path: "/files/stats" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
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

    // Get file counts and sizes
    const stats = await filesDB.queryRow<{
      total_files: number;
      total_directories: number;
      total_size: number;
    }>`
      SELECT 
        COUNT(CASE WHEN is_directory = false THEN 1 END) as total_files,
        COUNT(CASE WHEN is_directory = true THEN 1 END) as total_directories,
        COALESCE(SUM(CASE WHEN is_directory = false THEN size_bytes ELSE 0 END), 0) as total_size
      FROM files
      WHERE project_id = ${req.projectId}
    `;

    // Get files by type
    const filesByType = await filesDB.query<{
      mime_type: string | null;
      count: number;
      total_size: number;
    }>`
      SELECT 
        COALESCE(mime_type, 'unknown') as mime_type,
        COUNT(*) as count,
        COALESCE(SUM(size_bytes), 0) as total_size
      FROM files
      WHERE project_id = ${req.projectId}
      AND is_directory = false
      GROUP BY mime_type
      ORDER BY count DESC
    `;

    return {
      totalFiles: stats?.total_files || 0,
      totalDirectories: stats?.total_directories || 0,
      totalSize: stats?.total_size || 0,
      filesByType: filesByType.map(row => ({
        mimeType: row.mime_type || 'unknown',
        count: row.count,
        totalSize: row.total_size
      }))
    };
  }
);