import { describe, it, expect, beforeEach, vi } from "vitest";
import { listFiles, getFile, createFile, updateFile, deleteFile } from "./filesystem";
import type { CreateFileRequest, UpdateFileRequest } from "./types";

// Mock the auth module
const mockAuth = {
  userID: "test-user-123",
  email: "test@example.com"
};

vi.mock("~encore/auth", () => ({
  getAuthData: vi.fn(() => mockAuth)
}));

// Mock the database module
const mockDb = {
  queryAll: vi.fn(),
  queryRow: vi.fn(),
  exec: vi.fn(),
  begin: vi.fn(),
};

vi.mock("../db", () => ({
  default: mockDb
}));

describe("Filesystem Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listFiles", () => {
    it("should validate project ID", async () => {
      await expect(listFiles({ projectId: "" })).rejects.toThrow("Valid project ID is required");
    });

    it("should return hierarchical file structure", async () => {
      const mockFiles = [
        {
          id: "file-1",
          project_id: "project-123",
          name: "src",
          path: "/src",
          type: "directory",
          parent_id: null,
          content: null,
          size: 0,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: "file-2",
          project_id: "project-123",
          name: "App.tsx",
          path: "/src/App.tsx",
          type: "file",
          parent_id: "file-1",
          content: "import React from 'react';",
          size: 23,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.queryRow.mockResolvedValue({ id: "project-123" }); // project access
      mockDb.queryAll.mockResolvedValue(mockFiles);

      const result = await listFiles({ projectId: "project-123" });

      expect(result.files).toHaveLength(1); // Only root directory
      expect(result.files[0].name).toBe("src");
      expect(result.files[0].type).toBe("directory");
      expect(result.files[0].children).toHaveLength(1);
      expect(result.files[0].children![0].name).toBe("App.tsx");
    });

    it("should handle project access denied", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(listFiles({ projectId: "invalid-project" })).rejects.toThrow("Access denied to this project");
    });
  });

  describe("getFile", () => {
    it("should validate file ID", async () => {
      await expect(getFile({ id: "" })).rejects.toThrow("Valid file ID is required");
    });

    it("should return file details", async () => {
      const mockFile = {
        id: "file-123",
        project_id: "project-123",
        name: "App.tsx",
        path: "/src/App.tsx",
        type: "file",
        parent_id: "dir-1",
        content: "import React from 'react';",
        size: 23,
        created_at: new Date(),
        updated_at: new Date(),
        project_owner_id: "test-user-123"
      };

      mockDb.queryRow.mockResolvedValue(mockFile);

      const result = await getFile({ id: "file-123" });

      expect(result.id).toBe("file-123");
      expect(result.name).toBe("App.tsx");
      expect(result.content).toBe("import React from 'react';");
      expect(result.size).toBe(23);
    });

    it("should handle file not found", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(getFile({ id: "invalid-file" })).rejects.toThrow("File not found or access denied");
    });
  });

  describe("createFile", () => {
    it("should validate required fields", async () => {
      const req: CreateFileRequest = {
        projectId: "",
        path: "/test.txt",
        type: "file"
      };

      await expect(createFile(req)).rejects.toThrow("Project ID, path, and type are required");
    });

    it("should validate file type", async () => {
      const req: CreateFileRequest = {
        projectId: "project-123",
        path: "/test.txt",
        type: "invalid" as any
      };

      await expect(createFile(req)).rejects.toThrow("Type must be 'file' or 'directory'");
    });

    it("should create file successfully", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce({ id: "project-123" }) // project access
        .mockResolvedValueOnce(null) // file doesn't exist
        .mockResolvedValueOnce(null) // no parent directory
        .mockResolvedValueOnce({ id: "file-123" }); // created file

      const req: CreateFileRequest = {
        projectId: "project-123",
        path: "/test.txt",
        type: "file",
        content: "Hello world"
      };

      const result = await createFile(req);

      expect(result.id).toBe("file-123");
      expect(result.name).toBe("test.txt");
      expect(result.path).toBe("/test.txt");
      expect(result.content).toBe("Hello world");
      expect(result.size).toBe(11);
    });

    it("should handle file already exists", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce({ id: "project-123" }) // project access
        .mockResolvedValueOnce({ id: "existing-file" }); // file exists

      const req: CreateFileRequest = {
        projectId: "project-123",
        path: "/test.txt",
        type: "file"
      };

      await expect(createFile(req)).rejects.toThrow("File already exists at this path");
    });

    it("should handle project access denied", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      const req: CreateFileRequest = {
        projectId: "invalid-project",
        path: "/test.txt",
        type: "file"
      };

      await expect(createFile(req)).rejects.toThrow("Write access denied to this project");
    });
  });

  describe("updateFile", () => {
    const mockFile = {
      id: "file-123",
      project_id: "project-123",
      name: "test.txt",
      path: "/test.txt",
      type: "file",
      parent_id: null,
      content: "original content",
      size: 16,
      created_at: new Date(),
      updated_at: new Date(),
      project_owner_id: "test-user-123"
    };

    it("should validate file ID", async () => {
      await expect(updateFile({ id: "", content: "new content" })).rejects.toThrow("Valid file ID is required");
    });

    it("should validate content is provided", async () => {
      mockDb.queryRow.mockResolvedValue(mockFile);

      await expect(updateFile({ id: "file-123" } as any)).rejects.toThrow("Content is required for file updates");
    });

    it("should prevent updating directory content", async () => {
      const dirFile = { ...mockFile, type: "directory" };
      mockDb.queryRow.mockResolvedValue(dirFile);

      await expect(updateFile({ 
        id: "file-123", 
        content: "new content" 
      })).rejects.toThrow("Cannot update content of directory");
    });

    it("should update file successfully", async () => {
      mockDb.queryRow.mockResolvedValue(mockFile);
      mockDb.exec.mockResolvedValue(undefined);

      const req: UpdateFileRequest & { id: string } = {
        id: "file-123",
        content: "new content"
      };

      const result = await updateFile(req);

      expect(result.content).toBe("new content");
      expect(result.size).toBe(11);
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE files SET content"),
        "new content",
        11,
        "file-123"
      );
    });

    it("should handle file not found", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(updateFile({ 
        id: "invalid-file", 
        content: "new content" 
      })).rejects.toThrow("File not found or write access denied");
    });
  });

  describe("deleteFile", () => {
    it("should validate file ID", async () => {
      await expect(deleteFile({ id: "" })).rejects.toThrow("Valid file ID is required");
    });

    it("should delete file successfully", async () => {
      const mockFile = {
        id: "file-123",
        type: "file"
      };

      const mockTx = {
        exec: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined)
      };

      mockDb.queryRow.mockResolvedValue(mockFile);
      mockDb.begin.mockResolvedValue(mockTx);

      const result = await deleteFile({ id: "file-123" });

      expect(result.success).toBe(true);
      expect(mockTx.exec).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM files WHERE id"),
        "file-123"
      );
      expect(mockTx.commit).toHaveBeenCalled();
    });

    it("should handle file not found", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(deleteFile({ id: "invalid-file" })).rejects.toThrow("File not found or write access denied");
    });

    it("should handle transaction error", async () => {
      const mockFile = {
        id: "file-123",
        type: "file"
      };

      const mockTx = {
        exec: vi.fn().mockRejectedValue(new Error("Database error")),
        rollback: vi.fn().mockResolvedValue(undefined)
      };

      mockDb.queryRow.mockResolvedValue(mockFile);
      mockDb.begin.mockResolvedValue(mockTx);

      await expect(deleteFile({ id: "file-123" })).rejects.toThrow("Failed to delete file");
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });
});