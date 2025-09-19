import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Bucket } from "encore.dev/storage/objects";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { filesDB } from "./db";
import { File } from "./types";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

const projectFilesBucket = new Bucket("project-files", {
  public: false,
  versioned: true
});

export interface SaveFileRequest {
  projectId: string;
  path: string;
  name: string;
  content: string;
  mimeType?: string;
  parentId?: string;
  createVersion?: boolean;
}

export interface SaveBinaryFileRequest {
  projectId: string;
  path: string;
  name: string;
  data: Buffer;
  mimeType?: string;
  parentId?: string;
  createVersion?: boolean;
}

export const saveFile = api<SaveFileRequest, File>(
  { auth: true, expose: true, method: "POST", path: "/files" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.name || !req.path || req.content === undefined) {
      throw APIError.invalidArgument("Project ID, name, path, and content are required");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    // Validate file name
    if (req.name.includes('/') || req.name.includes('\\') || req.name.trim() === '') {
      throw APIError.invalidArgument("Invalid file name");
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

    const contentBuffer = Buffer.from(req.content, 'utf8');
    const sizeBytes = contentBuffer.length;
    
    // Generate object name for storage
    const objectName = `${req.projectId}/${fullPath}`;

    try {
      // Check if file already exists
      const existingFile = await filesDB.queryRow<{ 
        id: string; 
        content: string | null;
      }>`
        SELECT id, content FROM files 
        WHERE project_id = ${req.projectId} 
        AND path = ${fullPath}
        AND is_directory = false
      `;

      let fileId: string;
      let isUpdate = false;

      if (existingFile) {
        isUpdate = true;
        fileId = existingFile.id;

        // Create version if requested and content has changed
        if (req.createVersion && existingFile.content !== req.content) {
          // Get current version number
          const lastVersion = await filesDB.queryRow<{ version_number: number }>`
            SELECT COALESCE(MAX(version_number), 0) as version_number
            FROM file_versions 
            WHERE file_id = ${fileId}
          `;

          const nextVersion = (lastVersion?.version_number || 0) + 1;

          // Create new version record
          await filesDB.exec`
            INSERT INTO file_versions (file_id, content, version_number, user_id)
            VALUES (${fileId}, ${existingFile.content || ''}, ${nextVersion}, ${auth.userID})
          `;
        }

        // Update existing file
        await filesDB.exec`
          UPDATE files 
          SET 
            content = ${req.content},
            mime_type = ${req.mimeType || null},
            size_bytes = ${sizeBytes},
            user_id = ${auth.userID},
            updated_at = NOW()
          WHERE id = ${fileId}
        `;
      } else {
        // Create new file
        const newFile = await filesDB.queryRow<{ id: string }>`
          INSERT INTO files (
            project_id, 
            name, 
            path, 
            content,
            mime_type,
            size_bytes,
            is_directory, 
            parent_id, 
            user_id
          )
          VALUES (
            ${req.projectId}, 
            ${req.name}, 
            ${fullPath}, 
            ${req.content},
            ${req.mimeType || null},
            ${sizeBytes},
            false, 
            ${req.parentId || null}, 
            ${auth.userID}
          )
          RETURNING id
        `;

        if (!newFile) {
          throw APIError.internal("Failed to create file record");
        }

        fileId = newFile.id;
      }

      // Store file content in object storage
      await projectFilesBucket.upload(objectName, contentBuffer, {
        contentType: req.mimeType || 'text/plain'
      });

      // Retrieve and return the updated file
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
        WHERE id = ${fileId}
      `;

      if (!file) {
        throw APIError.internal("Failed to retrieve saved file");
      }

      return {
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
      };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to save file: " + (error as Error).message);
    }
  }
);

export const saveBinaryFile = api<SaveBinaryFileRequest, File>(
  { auth: true, expose: true, method: "POST", path: "/files/binary" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.name || !req.path || !req.data) {
      throw APIError.invalidArgument("Project ID, name, path, and data are required");
    }

    // Verify project access
    const projectAccess = await projectsDB.queryRow`
      SELECT p.id
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${req.projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    // Validate file name
    if (req.name.includes('/') || req.name.includes('\\') || req.name.trim() === '') {
      throw APIError.invalidArgument("Invalid file name");
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

    const sizeBytes = req.data.length;
    
    // Generate object name for storage
    const objectName = `${req.projectId}/${fullPath}`;

    try {
      // Check if file already exists
      const existingFile = await filesDB.queryRow<{ 
        id: string; 
      }>`
        SELECT id FROM files 
        WHERE project_id = ${req.projectId} 
        AND path = ${fullPath}
        AND is_directory = false
      `;

      let fileId: string;

      if (existingFile) {
        fileId = existingFile.id;

        // Update existing file (binary files don't store content in DB)
        await filesDB.exec`
          UPDATE files 
          SET 
            mime_type = ${req.mimeType || null},
            size_bytes = ${sizeBytes},
            user_id = ${auth.userID},
            updated_at = NOW()
          WHERE id = ${fileId}
        `;
      } else {
        // Create new file (no content in DB for binary files)
        const newFile = await filesDB.queryRow<{ id: string }>`
          INSERT INTO files (
            project_id, 
            name, 
            path, 
            mime_type,
            size_bytes,
            is_directory, 
            parent_id, 
            user_id
          )
          VALUES (
            ${req.projectId}, 
            ${req.name}, 
            ${fullPath}, 
            ${req.mimeType || null},
            ${sizeBytes},
            false, 
            ${req.parentId || null}, 
            ${auth.userID}
          )
          RETURNING id
        `;

        if (!newFile) {
          throw APIError.internal("Failed to create file record");
        }

        fileId = newFile.id;
      }

      // Store file data in object storage
      await projectFilesBucket.upload(objectName, req.data, {
        contentType: req.mimeType || 'application/octet-stream'
      });

      // Retrieve and return the updated file
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
        WHERE id = ${fileId}
      `;

      if (!file) {
        throw APIError.internal("Failed to retrieve saved file");
      }

      return {
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
      };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to save binary file: " + (error as Error).message);
    }
  }
);

export const getUploadUrl = api<{
  projectId: string;
  path: string;
  name: string;
  ttl?: number;
}, { uploadUrl: string; objectName: string }>(
  { auth: true, expose: true, method: "POST", path: "/files/upload-url" },
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
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!projectAccess) {
      throw APIError.notFound("Project not found or insufficient permissions");
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

    const objectName = `${req.projectId}/${fullPath}`;

    try {
      const { url } = await projectFilesBucket.signedUploadUrl(objectName, {
        ttl: req.ttl || 3600 // Default 1 hour
      });

      return {
        uploadUrl: url,
        objectName
      };
    } catch (error) {
      throw APIError.internal("Failed to generate upload URL: " + (error as Error).message);
    }
  }
);