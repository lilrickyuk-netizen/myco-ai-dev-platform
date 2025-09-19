import { api } from "encore.dev/api";
import type { FileNode, CreateFileRequest, UpdateFileRequest, FileListResponse } from "./types";

export const listFiles = api(
  { expose: true, method: "GET", path: "/filesystem/:projectId" },
  async ({ projectId }: { projectId: string }): Promise<FileListResponse> => {
    // Mock data for now
    return {
      files: [
        {
          id: "1",
          name: "src",
          path: "/src",
          type: "directory",
          children: [
            {
              id: "2",
              name: "App.tsx",
              path: "/src/App.tsx",
              type: "file",
              content: "import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;",
              size: 95,
              lastModified: new Date(),
            }
          ]
        }
      ]
    };
  }
);

export const getFile = api(
  { expose: true, method: "GET", path: "/filesystem/file/:id" },
  async ({ id }: { id: string }): Promise<FileNode> => {
    // Mock implementation
    return {
      id,
      name: "App.tsx",
      path: "/src/App.tsx",
      type: "file",
      content: "import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;",
      size: 95,
      lastModified: new Date(),
    };
  }
);

export const createFile = api(
  { expose: true, method: "POST", path: "/filesystem/file" },
  async (req: CreateFileRequest): Promise<FileNode> => {
    // Mock implementation
    return {
      id: Date.now().toString(),
      name: req.path.split('/').pop() || "untitled",
      path: req.path,
      type: req.type,
      content: req.content || "",
      size: req.content?.length || 0,
      lastModified: new Date(),
    };
  }
);

export const updateFile = api(
  { expose: true, method: "PUT", path: "/filesystem/file/:id" },
  async ({ id, ...req }: UpdateFileRequest & { id: string }): Promise<FileNode> => {
    // Mock implementation
    return {
      id,
      name: "App.tsx",
      path: "/src/App.tsx",
      type: "file",
      content: req.content,
      size: req.content.length,
      lastModified: new Date(),
    };
  }
);

export const deleteFile = api(
  { expose: true, method: "DELETE", path: "/filesystem/file/:id" },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    // Mock implementation
    return { success: true };
  }
);