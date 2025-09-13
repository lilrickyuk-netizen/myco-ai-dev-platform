import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { FileTreeNode } from "./types";
import { projects } from "~encore/clients";

interface ListFilesRequest {
  projectId: string;
  path?: string;
}

interface ListFilesResponse {
  files: FileTreeNode[];
}

// Lists files and directories in a project.
export const list = api<ListFilesRequest, ListFilesResponse>(
  { auth: true, expose: true, method: "GET", path: "/files/:projectId" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify user has access to the project
    try {
      await projects.get({ id: req.projectId });
    } catch (err) {
      throw APIError.permissionDenied("access denied to project");
    }

    const basePath = req.path || "";
    const searchPattern = basePath ? `${basePath}/%` : "%";
    
    const files: FileTreeNode[] = [];
    for await (const row of filesDB.query<{
      path: string;
      isDirectory: boolean;
      sizeBytes: number;
    }>`
      SELECT 
        path,
        is_directory as "isDirectory",
        size_bytes as "sizeBytes"
      FROM project_files 
      WHERE project_id = ${req.projectId} 
        AND path LIKE ${searchPattern}
        AND path != ${basePath}
      ORDER BY is_directory DESC, path ASC
    `) {
      const relativePath = basePath ? row.path.substring(basePath.length + 1) : row.path;
      const pathParts = relativePath.split('/');
      
      if (pathParts.length === 1) {
        files.push({
          name: pathParts[0],
          path: row.path,
          isDirectory: row.isDirectory,
          size: row.isDirectory ? undefined : row.sizeBytes,
        });
      }
    }

    return { files };
  }
);
