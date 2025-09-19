import { describe, it, expect, beforeEach, vi } from "vitest";
import { list, create, get, update, remove } from "./project";
import type { CreateProjectRequest, UpdateProjectRequest } from "./types";

// Mock the auth module
const mockAuth = {
  userID: "test-user-123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  imageUrl: "https://example.com/avatar.jpg"
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
  rawExec: vi.fn(),
};

vi.mock("../db", () => ({
  default: mockDb
}));

describe("Project Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return projects for authenticated user", async () => {
      const mockProjects = [
        {
          id: "project-1",
          name: "Test Project 1",
          description: "A test project",
          owner_id: "test-user-123",
          template_type: "react-typescript",
          repository_url: null,
          status: "active",
          visibility: "private",
          created_at: new Date("2024-01-01"),
          updated_at: new Date("2024-01-02")
        }
      ];

      mockDb.exec.mockResolvedValue(undefined); // user upsert
      mockDb.queryAll.mockResolvedValue(mockProjects);

      const result = await list();

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].id).toBe("project-1");
      expect(result.projects[0].name).toBe("Test Project 1");
      expect(result.projects[0].templateName).toBe("React TypeScript");
      expect(result.projects[0].isOwner).toBe(true);
    });

    it("should handle empty project list", async () => {
      mockDb.exec.mockResolvedValue(undefined);
      mockDb.queryAll.mockResolvedValue([]);

      const result = await list();

      expect(result.projects).toHaveLength(0);
    });
  });

  describe("create", () => {
    it("should validate required name", async () => {
      const req: CreateProjectRequest = {
        name: "",
        description: "Test project"
      };

      await expect(create(req)).rejects.toThrow("Project name is required");
    });

    it("should validate name length", async () => {
      const req: CreateProjectRequest = {
        name: "a".repeat(101),
        description: "Test project"
      };

      await expect(create(req)).rejects.toThrow("Project name too long");
    });

    it("should validate description length", async () => {
      const req: CreateProjectRequest = {
        name: "Test Project",
        description: "a".repeat(501)
      };

      await expect(create(req)).rejects.toThrow("Project description too long");
    });

    it("should create project successfully", async () => {
      const req: CreateProjectRequest = {
        name: "Test Project",
        description: "A test project",
        template: "react-typescript",
        visibility: "private"
      };

      mockDb.exec.mockResolvedValue(undefined); // user upsert
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });

      const result = await create(req);

      expect(result.id).toBe("project-123");
      expect(result.name).toBe("Test Project");
      expect(result.description).toBe("A test project");
      expect(result.template).toBe("react-typescript");
      expect(result.visibility).toBe("private");
      expect(result.isOwner).toBe(true);
      
      // Verify database calls
      expect(mockDb.queryRow).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO projects"),
        "Test Project",
        "A test project",
        "test-user-123",
        "react-typescript",
        "active",
        "private"
      );
    });

    it("should use default values", async () => {
      const req: CreateProjectRequest = {
        name: "Test Project"
      };

      mockDb.exec.mockResolvedValue(undefined);
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });

      const result = await create(req);

      expect(result.template).toBe("react-typescript");
      expect(result.visibility).toBe("private");
    });

    it("should handle database error", async () => {
      const req: CreateProjectRequest = {
        name: "Test Project"
      };

      mockDb.exec.mockResolvedValue(undefined);
      mockDb.queryRow.mockResolvedValue(null);

      await expect(create(req)).rejects.toThrow("Failed to create project");
    });
  });

  describe("get", () => {
    it("should validate project ID", async () => {
      await expect(get({ id: "" })).rejects.toThrow("Valid project ID is required");
    });

    it("should return project details", async () => {
      const mockProject = {
        id: "project-123",
        name: "Test Project",
        description: "A test project",
        owner_id: "test-user-123",
        template_type: "react-typescript",
        repository_url: "https://github.com/user/repo",
        status: "active",
        visibility: "private",
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-02")
      };

      mockDb.queryRow.mockResolvedValue(mockProject);

      const result = await get({ id: "project-123" });

      expect(result.id).toBe("project-123");
      expect(result.name).toBe("Test Project");
      expect(result.repositoryUrl).toBe("https://github.com/user/repo");
      expect(result.isOwner).toBe(true);
    });

    it("should handle project not found", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(get({ id: "invalid-project" })).rejects.toThrow("Project not found or access denied");
    });
  });

  describe("update", () => {
    const mockProject = {
      id: "project-123",
      name: "Test Project",
      description: "A test project",
      owner_id: "test-user-123",
      template_type: "react-typescript",
      repository_url: null,
      status: "active",
      visibility: "private",
      created_at: new Date("2024-01-01"),
      updated_at: new Date("2024-01-02")
    };

    it("should validate project ID", async () => {
      await expect(update({ id: "", name: "New Name" })).rejects.toThrow("Valid project ID is required");
    });

    it("should validate name when provided", async () => {
      mockDb.queryRow.mockResolvedValue(mockProject);

      await expect(update({ id: "project-123", name: "" })).rejects.toThrow("Project name cannot be empty");
    });

    it("should validate description length", async () => {
      mockDb.queryRow.mockResolvedValue(mockProject);

      await expect(update({ 
        id: "project-123", 
        description: "a".repeat(501) 
      })).rejects.toThrow("Project description too long");
    });

    it("should restrict visibility changes to owner", async () => {
      const nonOwnerProject = { ...mockProject, owner_id: "other-user" };
      mockDb.queryRow.mockResolvedValue(nonOwnerProject);

      await expect(update({ 
        id: "project-123", 
        visibility: "public" 
      })).rejects.toThrow("Only project owner can change visibility");
    });

    it("should update project successfully", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce(mockProject) // access check
        .mockResolvedValueOnce({ ...mockProject, name: "Updated Project" }); // updated project
      
      mockDb.rawExec.mockResolvedValue(undefined);

      const req: UpdateProjectRequest & { id: string } = {
        id: "project-123",
        name: "Updated Project",
        description: "Updated description"
      };

      const result = await update(req);

      expect(result.name).toBe("Updated Project");
      expect(mockDb.rawExec).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE projects SET"),
        "project-123",
        "Updated Project",
        "Updated description"
      );
    });

    it("should handle project not found", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(update({ 
        id: "invalid-project", 
        name: "New Name" 
      })).rejects.toThrow("Project not found or edit access denied");
    });
  });

  describe("remove", () => {
    it("should validate project ID", async () => {
      await expect(remove({ id: "" })).rejects.toThrow("Valid project ID is required");
    });

    it("should delete project successfully", async () => {
      const mockProject = {
        id: "project-123",
        owner_id: "test-user-123"
      };

      const mockTx = {
        exec: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined)
      };

      mockDb.queryRow.mockResolvedValue(mockProject);
      mockDb.begin.mockResolvedValue(mockTx);

      const result = await remove({ id: "project-123" });

      expect(result.success).toBe(true);
      expect(mockTx.exec).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE projects SET status = 'deleted'"),
        "project-123"
      );
      expect(mockTx.commit).toHaveBeenCalled();
    });

    it("should handle unauthorized deletion", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      await expect(remove({ id: "project-123" })).rejects.toThrow("Project not found or not authorized to delete");
    });

    it("should handle transaction error", async () => {
      const mockProject = {
        id: "project-123",
        owner_id: "test-user-123"
      };

      const mockTx = {
        exec: vi.fn().mockRejectedValue(new Error("Database error")),
        rollback: vi.fn().mockResolvedValue(undefined)
      };

      mockDb.queryRow.mockResolvedValue(mockProject);
      mockDb.begin.mockResolvedValue(mockTx);

      await expect(remove({ id: "project-123" })).rejects.toThrow("Failed to delete project");
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });
});