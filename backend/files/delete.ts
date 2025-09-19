import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Bucket } from "encore.dev/storage/objects";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { filesDB } from "./db";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

const projectFilesBucket = new Bucket("project-files", {
  public: false,
  versioned: true
});

export interface DeleteFileRequest {
  fileId: string;
  force?: boolean;
}

export interface DeleteFileByPathRequest {
  projectId: string;
  path: string;
  force?: boolean;
}

export interface DeleteDirectoryRequest {
  directoryId: string;
  recursive?: boolean;
  force?: boolean;
}

export const deleteFile = api<DeleteFileRequest, { success: boolean; deletedCount: number }>(
  { auth: true, expose: true, method: "DELETE", path: "/files/:fileId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.fileId) {
      throw APIError.invalidArgument("File ID is required");
    }

    // Get file with project access verification
    const file = await filesDB.queryRow<{
      id: string;
      project_id: string;
      path: string;
      is_directory: boolean;
      user_id: string;
    }>`
      SELECT DISTINCT
        f.id,
        f.project_id,
        f.path,
        f.is_directory,
        f.user_id
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.id = ${req.fileId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!file) {
      throw APIError.notFound("File not found or access denied");
    }

    // Check if user can delete this file (owner or collaborator with permissions)
    const canDelete = file.user_id === auth.userID || req.force;
    if (!canDelete) {
      throw APIError.permissionDenied("Only the file creator can delete this file, unless force is used");
    }

    if (file.is_directory) {
      throw APIError.invalidArgument("Use deleteDirectory endpoint for directories");
    }

    try {
      let deletedCount = 0;

      // Delete file versions first
      await filesDB.exec`
        DELETE FROM file_versions WHERE file_id = ${file.id}
      `;

      // Delete from object storage
      const objectName = `${file.project_id}/${file.path}`;
      try {
        const exists = await projectFilesBucket.exists(objectName);
        if (exists) {
          await projectFilesBucket.remove(objectName);
        }
      } catch (storageError) {
        console.warn(`Failed to delete from object storage: ${objectName}`, storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete file record
      const result = await filesDB.exec`
        DELETE FROM files WHERE id = ${file.id}
      `;

      deletedCount = result.rowCount || 0;

      return { success: true, deletedCount };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete file: " + (error as Error).message);
    }
  }
);

export const deleteFileByPath = api<DeleteFileByPathRequest, { success: boolean; deletedCount: number }>(
  { auth: true, expose: true, method: "DELETE", path: "/files/by-path" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.path) {
      throw APIError.invalidArgument("Project ID and path are required");
    }

    // Normalize path
    let normalizedPath = req.path;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }

    // Get file with project access verification
    const file = await filesDB.queryRow<{
      id: string;
      project_id: string;
      path: string;
      is_directory: boolean;
      user_id: string;
    }>`
      SELECT DISTINCT
        f.id,
        f.project_id,
        f.path,
        f.is_directory,
        f.user_id
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.project_id = ${req.projectId}
      AND f.path = ${normalizedPath}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!file) {
      throw APIError.notFound("File not found or access denied");
    }

    // Check if user can delete this file
    const canDelete = file.user_id === auth.userID || req.force;
    if (!canDelete) {
      throw APIError.permissionDenied("Only the file creator can delete this file, unless force is used");
    }

    if (file.is_directory) {
      throw APIError.invalidArgument("Use deleteDirectory endpoint for directories");
    }

    try {
      let deletedCount = 0;

      // Delete file versions first
      await filesDB.exec`
        DELETE FROM file_versions WHERE file_id = ${file.id}
      `;

      // Delete from object storage
      const objectName = `${file.project_id}/${file.path}`;
      try {
        const exists = await projectFilesBucket.exists(objectName);
        if (exists) {
          await projectFilesBucket.remove(objectName);
        }
      } catch (storageError) {
        console.warn(`Failed to delete from object storage: ${objectName}`, storageError);
      }

      // Delete file record
      const result = await filesDB.exec`
        DELETE FROM files WHERE id = ${file.id}
      `;

      deletedCount = result.rowCount || 0;

      return { success: true, deletedCount };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete file: " + (error as Error).message);
    }
  }
);

export const deleteDirectory = api<DeleteDirectoryRequest, { success: boolean; deletedCount: number }>(
  { auth: true, expose: true, method: "DELETE", path: "/files/directories/:directoryId" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.directoryId) {
      throw APIError.invalidArgument("Directory ID is required");
    }

    // Get directory with project access verification
    const directory = await filesDB.queryRow<{
      id: string;
      project_id: string;
      path: string;
      is_directory: boolean;
      user_id: string;
    }>`
      SELECT DISTINCT
        f.id,
        f.project_id,
        f.path,
        f.is_directory,
        f.user_id
      FROM files f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE f.id = ${req.directoryId}
      AND f.is_directory = true
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.role IN ('admin', 'member') AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!directory) {
      throw APIError.notFound("Directory not found or access denied");
    }

    // Check if user can delete this directory
    const canDelete = directory.user_id === auth.userID || req.force;
    if (!canDelete) {
      throw APIError.permissionDenied("Only the directory creator can delete this directory, unless force is used");
    }

    try {
      let deletedCount = 0;

      if (req.recursive) {
        // Get all files and subdirectories recursively
        const allItems = await filesDB.query<{
          id: string;
          path: string;
          is_directory: boolean;
        }>`
          WITH RECURSIVE directory_tree AS (
            SELECT id, path, is_directory
            FROM files
            WHERE id = ${directory.id}
            
            UNION ALL
            
            SELECT f.id, f.path, f.is_directory
            FROM files f
            INNER JOIN directory_tree dt ON f.parent_id = dt.id
          )
          SELECT id, path, is_directory FROM directory_tree
          ORDER BY path DESC -- Delete deeper items first
        `;

        // Delete all file versions for files in this tree
        const fileIds = allItems
          .filter(item => !item.is_directory)
          .map(item => item.id);

        if (fileIds.length > 0) {
          await filesDB.exec`
            DELETE FROM file_versions 
            WHERE file_id = ANY(${fileIds})
          `;
        }

        // Delete from object storage
        for (const item of allItems) {
          if (!item.is_directory) {
            const objectName = `${directory.project_id}/${item.path}`;
            try {
              const exists = await projectFilesBucket.exists(objectName);
              if (exists) {
                await projectFilesBucket.remove(objectName);
              }
            } catch (storageError) {
              console.warn(`Failed to delete from object storage: ${objectName}`, storageError);
            }
          }
        }

        // Delete all items from database
        const result = await filesDB.exec`
          WITH RECURSIVE directory_tree AS (
            SELECT id
            FROM files
            WHERE id = ${directory.id}
            
            UNION ALL
            
            SELECT f.id
            FROM files f
            INNER JOIN directory_tree dt ON f.parent_id = dt.id
          )
          DELETE FROM files WHERE id IN (SELECT id FROM directory_tree)
        `;

        deletedCount = result.rowCount || 0;

      } else {
        // Check if directory is empty
        const hasChildren = await filesDB.queryRow`
          SELECT COUNT(*) as count FROM files WHERE parent_id = ${directory.id}
        `;

        if (hasChildren && hasChildren.count > 0) {
          throw APIError.failedPrecondition(
            "Directory is not empty. Use recursive=true to delete all contents."
          );
        }

        // Delete empty directory
        const result = await filesDB.exec`
          DELETE FROM files WHERE id = ${directory.id}
        `;

        deletedCount = result.rowCount || 0;
      }

      return { success: true, deletedCount };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to delete directory: " + (error as Error).message);
    }
  }
);

export const bulkDelete = api<{
  projectId: string;
  fileIds: string[];
  force?: boolean;
}, { success: boolean; deletedCount: number; errors: string[] }>(
  { auth: true, expose: true, method: "DELETE", path: "/files/bulk" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId || !req.fileIds || req.fileIds.length === 0) {
      throw APIError.invalidArgument("Project ID and file IDs are required");
    }

    if (req.fileIds.length > 100) {
      throw APIError.invalidArgument("Cannot delete more than 100 files at once");
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
      throw APIError.notFound("Project not found or access denied");
    }

    // Get all files to be deleted
    const files = await filesDB.query<{
      id: string;
      path: string;
      is_directory: boolean;
      user_id: string;
    }>`
      SELECT id, path, is_directory, user_id
      FROM files
      WHERE id = ANY(${req.fileIds})
      AND project_id = ${req.projectId}
    `;

    if (files.length === 0) {
      throw APIError.notFound("No files found with the provided IDs");
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Check permissions
        const canDelete = file.user_id === auth.userID || req.force;
        if (!canDelete) {
          errors.push(`File ${file.id}: Only the file creator can delete this file`);
          continue;
        }

        // Skip directories in bulk delete
        if (file.is_directory) {
          errors.push(`File ${file.id}: Cannot delete directories in bulk operation`);
          continue;
        }

        // Delete file versions
        await filesDB.exec`
          DELETE FROM file_versions WHERE file_id = ${file.id}
        `;

        // Delete from object storage
        const objectName = `${req.projectId}/${file.path}`;
        try {
          const exists = await projectFilesBucket.exists(objectName);
          if (exists) {
            await projectFilesBucket.remove(objectName);
          }
        } catch (storageError) {
          console.warn(`Failed to delete from object storage: ${objectName}`, storageError);
        }

        // Delete file record
        const result = await filesDB.exec`
          DELETE FROM files WHERE id = ${file.id}
        `;

        if (result.rowCount && result.rowCount > 0) {
          deletedCount += result.rowCount;
        }

      } catch (error) {
        errors.push(`File ${file.id}: ${(error as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      deletedCount,
      errors
    };
  }
);

export const cleanupOrphanedFiles = api<{ projectId: string }, { 
  success: boolean; 
  cleanedFiles: number; 
  cleanedStorage: number;
}>(
  { auth: true, expose: true, method: "POST", path: "/files/cleanup" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.projectId) {
      throw APIError.invalidArgument("Project ID is required");
    }

    // Verify project ownership (only owners can run cleanup)
    const project = await filesDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    try {
      let cleanedFiles = 0;
      let cleanedStorage = 0;

      // Find files in database that don't exist in object storage
      const allFiles = await filesDB.query<{
        id: string;
        path: string;
        is_directory: boolean;
        size_bytes: number;
      }>`
        SELECT id, path, is_directory, size_bytes
        FROM files
        WHERE project_id = ${req.projectId}
        AND is_directory = false
      `;

      for (const file of allFiles) {
        const objectName = `${req.projectId}/${file.path}`;
        
        try {
          const exists = await projectFilesBucket.exists(objectName);
          
          if (!exists) {
            // File exists in database but not in storage - clean it up
            await filesDB.exec`
              DELETE FROM file_versions WHERE file_id = ${file.id}
            `;
            
            const result = await filesDB.exec`
              DELETE FROM files WHERE id = ${file.id}
            `;
            
            if (result.rowCount && result.rowCount > 0) {
              cleanedFiles += result.rowCount;
              cleanedStorage += file.size_bytes;
            }
          }
        } catch (error) {
          console.warn(`Error checking file existence: ${objectName}`, error);
        }
      }

      return {
        success: true,
        cleanedFiles,
        cleanedStorage
      };

    } catch (error) {
      throw APIError.internal("Failed to cleanup orphaned files: " + (error as Error).message);
    }
  }
);