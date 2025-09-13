import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { filesDB } from "./db";
import { projectsDB } from "../projects/db";
import { File, FileTree } from "./types";

export interface ListFilesParams {
  projectId: string;
}

export interface ListFilesResponse {
  files: FileTree[];
}

// Lists all files in a project as a tree structure.
export const list = api<ListFilesParams, ListFilesResponse>(
  { auth: true, expose: true, method: "GET", path: "/files/:projectId" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found");
    }

    // Get all files for the project
    const files: File[] = [];
    for await (const row of filesDB.query<File>`
      SELECT 
        id,
        project_id as "projectId",
        name,
        path,
        content,
        mime_type as "mimeType",
        size_bytes as "sizeBytes",
        is_directory as "isDirectory",
        parent_id as "parentId",
        user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM files 
      WHERE project_id = ${projectId}
      ORDER BY is_directory DESC, name ASC
    `) {
      files.push(row);
    }

    // Build tree structure
    const fileMap = new Map<string, FileTree>();
    const rootFiles: FileTree[] = [];

    // First pass: create all nodes
    for (const file of files) {
      const treeNode: FileTree = {
        id: file.id,
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        content: file.content,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        updatedAt: file.updatedAt,
        children: file.isDirectory ? [] : undefined,
      };
      fileMap.set(file.id, treeNode);
    }

    // Second pass: build hierarchy
    for (const file of files) {
      const node = fileMap.get(file.id)!;
      if (file.parentId) {
        const parent = fileMap.get(file.parentId);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        rootFiles.push(node);
      }
    }

    return { files: rootFiles };
  }
);