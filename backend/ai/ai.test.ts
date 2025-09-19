import { describe, it, expect, beforeEach, vi } from "vitest";
import { generate, chat } from "./ai";
import type { GenerateRequest } from "./types";

// Mock the auth module
vi.mock("~encore/auth", () => ({
  getAuthData: vi.fn(() => ({
    userID: "test-user-123",
    email: "test@example.com"
  }))
}));

// Mock the database module
const mockDb = {
  queryRow: vi.fn(),
  exec: vi.fn(),
};

vi.mock("../db", () => ({
  default: mockDb
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.AI_ENGINE_URL = "http://test-ai-engine:8001";
  });

  describe("generate", () => {
    it("should validate prompt is required", async () => {
      const req: GenerateRequest = {
        prompt: "",
        model: "gpt-3.5-turbo"
      };

      await expect(generate(req)).rejects.toThrow("Valid prompt is required");
    });

    it("should validate prompt length", async () => {
      const req: GenerateRequest = {
        prompt: "a".repeat(33000),
        model: "gpt-3.5-turbo"
      };

      await expect(generate(req)).rejects.toThrow("Prompt too long");
    });

    it("should validate project access when projectId provided", async () => {
      mockDb.queryRow.mockResolvedValue(null);

      const req: GenerateRequest = {
        prompt: "test prompt",
        projectId: "invalid-project"
      };

      await expect(generate(req)).rejects.toThrow("Access denied to this project");
    });

    it("should successfully generate text", async () => {
      // Mock project access check
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      mockDb.exec.mockResolvedValue(undefined);

      // Mock AI Engine response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: "Generated response"
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });

      const req: GenerateRequest = {
        prompt: "test prompt",
        projectId: "project-123",
        model: "gpt-3.5-turbo"
      };

      const result = await generate(req);

      expect(result.content).toBe("Generated response");
      expect(result.usage?.totalTokens).toBe(30);
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO ai_generations"),
        expect.any(String), // user_id
        "project-123",
        "test prompt",
        "Generated response",
        "gpt-3.5-turbo",
        10, 20, 30
      );
    });

    it("should handle AI Engine timeout", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      // Mock timeout by rejecting after delay
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 100);
        })
      );

      const req: GenerateRequest = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("Request timeout");
    });

    it("should handle AI Engine rate limit", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limited" })
      });

      const req: GenerateRequest = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("Rate limit exceeded");
    });

    it("should handle AI Engine server error", async () => {
      mockDb.queryRow.mockResolvedValue({ id: "project-123" });
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "Service unavailable" })
      });

      const req: GenerateRequest = {
        prompt: "test prompt",
        projectId: "project-123"
      };

      await expect(generate(req)).rejects.toThrow("AI service temporarily unavailable");
    });
  });

  describe("chat", () => {
    it("should validate messages array", async () => {
      const req = {
        messages: []
      };

      await expect(chat(req)).rejects.toThrow("Messages array is required");
    });

    it("should validate last message is from user", async () => {
      const req = {
        messages: [{
          id: "1",
          role: "assistant" as const,
          content: "Hello",
          timestamp: new Date()
        }]
      };

      await expect(chat(req)).rejects.toThrow("Last message must be from user");
    });

    it("should create new session when sessionId not provided", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce({ id: "project-123" }) // project access
        .mockResolvedValueOnce({ id: "session-123" }); // new session
      
      mockDb.exec.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: "Chat response"
            }
          }]
        })
      });

      const req = {
        messages: [{
          id: "1",
          role: "user" as const,
          content: "Hello",
          timestamp: new Date()
        }],
        projectId: "project-123"
      };

      const result = await chat(req);

      expect(result.sessionId).toBe("session-123");
      expect(result.message.content).toBe("Chat response");
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO chat_sessions"),
        expect.any(String), // user_id
        "project-123",
        "Hello"
      );
    });

    it("should use existing session when sessionId provided", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce({ id: "project-123" }) // project access
        .mockResolvedValueOnce({ id: "session-123" }); // existing session
      
      mockDb.exec.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: "Chat response"
            }
          }]
        })
      });

      const req = {
        sessionId: "session-123",
        messages: [{
          id: "1",
          role: "user" as const,
          content: "Hello",
          timestamp: new Date()
        }],
        projectId: "project-123"
      };

      const result = await chat(req);

      expect(result.sessionId).toBe("session-123");
    });

    it("should handle AI Engine error with fallback", async () => {
      mockDb.queryRow
        .mockResolvedValueOnce({ id: "project-123" }) // project access
        .mockResolvedValueOnce({ id: "session-123" }); // session
      
      mockDb.exec.mockResolvedValue(undefined);

      mockFetch.mockRejectedValue(new Error("Network error"));

      const req = {
        sessionId: "session-123",
        messages: [{
          id: "1",
          role: "user" as const,
          content: "Hello",
          timestamp: new Date()
        }],
        projectId: "project-123"
      };

      const result = await chat(req);

      expect(result.message.content).toContain("technical difficulties");
      expect(result.sessionId).toBe("session-123");
    });
  });
});