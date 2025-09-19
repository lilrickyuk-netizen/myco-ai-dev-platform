import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Bucket } from "encore.dev/storage/objects";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { filesDB } from "./db";
import { File, FileVersion } from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

const projectFilesBucket = new Bucket("project-files", {
  public: false,
  versioned: true
});

export interface GetFileRequest {
  fileId: string;
  includeContent?: boolean;
}

export interface GetFileByPathRequest {
  projectId: string;
  path: string;
  includeContent?: boolean;
}

export interface GetFileVersionsRequest {
  fileId: string;
}

export interface GetFileContentRequest {
  fileId: string;
  version?: string;
}

export const getFile = api<GetFileRequest, File | null>(
  { auth: true, expose: true, method: "GET", path: "/files/:fileId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.fileId) {
      throw APIError.invalidArgument("File ID is required");
    }

    // Get file first
    const file = await filesDB.queryRow<{
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
      SELECT 
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
      FROM files
      WHERE id = ${req.fileId}
    `;

    if (!file) {
      return null;
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${file.project_id}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      return null;
    }

    let content = file.content;

    // If content is not in database and includeContent is true, try to get it from object storage
    if (req.includeContent && !content && !file.is_directory) {
      try {
        const objectName = `${file.project_id}/${file.path}`;
        const exists = await projectFilesBucket.exists(objectName);
        
        if (exists) {
          const buffer = await projectFilesBucket.download(objectName);
          content = buffer.toString('utf8');
        }
      } catch (error) {
        // If we can't retrieve from object storage, continue without content
        console.warn(`Failed to retrieve content for file ${file.id} from object storage:`, error);
      }
    }

    return {
      id: file.id,
      projectId: file.project_id,
      name: file.name,
      path: file.path,
      content: req.includeContent ? content : undefined,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      isDirectory: file.is_directory,
      parentId: file.parent_id,
      userId: file.user_id,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    };
  }
);

export const getFileByPath = api<GetFileByPathRequest, File | null>(
  { auth: true, expose: true, method: "GET", path: "/files/by-path" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.path) {
      throw APIError.invalidArgument("Project ID and path are required");
    }

    // Verify project access first
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
      return null;
    }

    // Normalize path
    let normalizedPath = req.path;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }

    // Get file
    const file = await filesDB.queryRow<{
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
      SELECT 
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
      FROM files
      WHERE project_id = ${req.projectId}
      AND path = ${normalizedPath}
    `;

    if (!file) {
      return null;
    }

    let content = file.content;

    // If content is not in database and includeContent is true, try to get it from object storage
    if (req.includeContent && !content && !file.is_directory) {
      try {
        const objectName = `${file.project_id}/${file.path}`;
        const exists = await projectFilesBucket.exists(objectName);
        
        if (exists) {
          const buffer = await projectFilesBucket.download(objectName);
          content = buffer.toString('utf8');
        }
      } catch (error) {
        console.warn(`Failed to retrieve content for file ${file.id} from object storage:`, error);
      }
    }

    return {
      id: file.id,
      projectId: file.project_id,
      name: file.name,
      path: file.path,
      content: req.includeContent ? content : undefined,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      isDirectory: file.is_directory,
      parentId: file.parent_id,
      userId: file.user_id,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    };
  }
);

export const getFileContent = api<GetFileContentRequest, { content: string } | { binaryUrl: string }>(
  { auth: true, expose: true, method: "GET", path: "/files/:fileId/content" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.fileId) {
      throw APIError.invalidArgument("File ID is required");
    }

    // Get file first
    const file = await filesDB.queryRow<{
      id: string;
      project_id: string;
      path: string;
      content: string | null;
      mime_type: string | null;
      is_directory: boolean;
    }>`
      SELECT 
        id,
        project_id,
        path,
        content,
        mime_type,
        is_directory
      FROM files
      WHERE id = ${req.fileId}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${file.project_id}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("File not found or access denied");
    }

    if (file.is_directory) {
      throw APIError.invalidArgument("Cannot get content of a directory");
    }

    // If content is in database (text files), return it
    if (file.content !== null) {
      return { content: file.content };
    }

    // For binary files or files stored in object storage
    try {
      const objectName = `${file.project_id}/${file.path}`;
      const exists = await projectFilesBucket.exists(objectName);
      
      if (!exists) {
        throw APIError.notFound("File content not found in storage");
      }

      // Check if it's a text file based on mime type
      const isText = file.mime_type?.startsWith('text/') || 
                    file.mime_type === 'application/json' ||
                    file.mime_type === 'application/javascript' ||
                    file.mime_type === 'application/typescript' ||
                    !file.mime_type; // Default to text if no mime type

      if (isText) {
        const buffer = await projectFilesBucket.download(objectName, {
          version: req.version
        });
        return { content: buffer.toString('utf8') };
      } else {
        // For binary files, return a signed download URL
        const { url } = await projectFilesBucket.signedDownloadUrl(objectName, {
          ttl: 3600 // 1 hour
        });
        return { binaryUrl: url };
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve file content: " + (error as Error).message);
    }
  }
);

export const getFileVersions = api<GetFileVersionsRequest, FileVersion[]>(
  { auth: true, expose: true, method: "GET", path: "/files/:fileId/versions" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.fileId) {
      throw APIError.invalidArgument("File ID is required");
    }

    // Get file first to verify access
    const file = await filesDB.queryRow<{ project_id: string }>`
      SELECT project_id FROM files WHERE id = ${req.fileId}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${file.project_id}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("File not found or access denied");
    }

    // Get all versions for this file
    const versions = await filesDB.query<{
      id: string;
      file_id: string;
      content: string;
      version_number: number;
      user_id: string;
      commit_message: string | null;
      created_at: Date;
    }>`
      SELECT 
        id,
        file_id,
        content,
        version_number,
        user_id,
        commit_message,
        created_at
      FROM file_versions
      WHERE file_id = ${req.fileId}
      ORDER BY version_number DESC
    `;

    const result = [];
    for await (const version of versions) {
      result.push({
        id: version.id,
        fileId: version.file_id,
        content: version.content,
        versionNumber: version.version_number,
        userId: version.user_id,
        commitMessage: version.commit_message,
        createdAt: version.created_at
      });
    }

    return result;
  }
);

export const getDownloadUrl = api<{
  fileId: string;
  ttl?: number;
}, { downloadUrl: string }>(
  { auth: true, expose: true, method: "GET", path: "/files/:fileId/download-url" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.fileId) {
      throw APIError.invalidArgument("File ID is required");
    }

    // Get file first
    const file = await filesDB.queryRow<{
      id: string;
      project_id: string;
      path: string;
      is_directory: boolean;
    }>`
      SELECT 
        id,
        project_id,
        path,
        is_directory
      FROM files
      WHERE id = ${req.fileId}
    `;

    if (!file) {
      throw APIError.notFound("File not found");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${file.project_id}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("File not found or access denied");
    }

    if (file.is_directory) {
      throw APIError.invalidArgument("Cannot generate download URL for a directory");
    }

    try {
      const objectName = `${file.project_id}/${file.path}`;
      const { url } = await projectFilesBucket.signedDownloadUrl(objectName, {
        ttl: req.ttl || 3600 // Default 1 hour
      });

      return { downloadUrl: url };
    } catch (error) {
      throw APIError.internal("Failed to generate download URL: " + (error as Error).message);
    }
  }
);