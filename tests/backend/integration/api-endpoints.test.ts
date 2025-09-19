import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { APIError } from 'encore.dev/api';

// Import API endpoints to test
import { generate, chat } from '../../../backend/ai/ai';
import { listFiles, getFile, createFile, updateFile, deleteFile } from '../../../backend/filesystem/filesystem';
import { health, ready } from '../../../backend/main/health';

// Mock external dependencies
global.fetch = vi.fn();

// Mock Clerk dependencies
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn()
    }
  })),
  verifyToken: vi.fn()
}));

vi.mock('encore.dev/config', () => ({
  secret: vi.fn(() => () => 'mock-secret-key')
}));

vi.mock('../../../backend/main/env-validation', () => ({
  validateEnvironment: vi.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
    missingOptional: []
  }))
}));

describe('Backend API Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.AI_ENGINE_URL = 'http://localhost:8001';
  });

  afterAll(async () => {
    // Cleanup
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AI Service Integration', () => {
    it('should handle complete AI generation workflow', async () => {
      // Mock successful AI engine response
      const mockAIResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'function hello() { return "Hello, World!"; }'
            }
          }],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 30,
            total_tokens: 50
          }
        })
      };

      (fetch as any).mockResolvedValue(mockAIResponse);

      // Test the complete flow
      const result = await generate({
        prompt: 'Generate a hello world function in JavaScript',
        model: 'gpt-4'
      });

      expect(result).toMatchObject({
        content: expect.stringContaining('function hello()'),
        usage: {
          promptTokens: 20,
          completionTokens: 30,
          totalTokens: 50
        }
      });

      // Verify the request was made correctly
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8001/generation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Generate a hello world function in JavaScript',
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Generate a hello world function in JavaScript' }]
          })
        }
      );
    });

    it('should handle AI service unavailable gracefully', async () => {
      (fetch as any).mockRejectedValue(new Error('Service unavailable'));

      const result = await generate({
        prompt: 'Test prompt',
        model: 'gpt-4'
      });

      expect(result.content).toContain('AI service temporarily unavailable');
      expect(result.content).toContain('Test prompt');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle chat conversation flow', async () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello, how can I implement user authentication?',
          timestamp: new Date()
        }
      ];

      const result = await chat({ messages });

      expect(result).toMatchObject({
        id: expect.any(String),
        role: 'assistant',
        content: expect.stringContaining('user authentication'),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Filesystem Service Integration', () => {
    it('should handle complete file management workflow', async () => {
      // 1. List files in a project
      const fileList = await listFiles({ projectId: 'test-project' });
      expect(fileList.files).toHaveLength(1);
      expect(fileList.files[0].name).toBe('src');

      // 2. Get a specific file
      const file = await getFile({ id: 'test-file-1' });
      expect(file.type).toBe('file');
      expect(file.content).toContain('React');

      // 3. Create a new file
      const newFile = await createFile({
        path: '/src/components/Button.tsx',
        type: 'file',
        content: 'export const Button = () => <button>Click me</button>;'
      });
      expect(newFile.name).toBe('Button.tsx');
      expect(newFile.content).toContain('Button');

      // 4. Update the file
      const updatedFile = await updateFile({
        id: newFile.id,
        content: 'export const Button = () => <button>Updated Button</button>;'
      });
      expect(updatedFile.content).toContain('Updated Button');

      // 5. Delete the file
      const deleteResult = await deleteFile({ id: newFile.id });
      expect(deleteResult.success).toBe(true);
    });

    it('should handle directory operations', async () => {
      const directory = await createFile({
        path: '/src/components',
        type: 'directory'
      });

      expect(directory.type).toBe('directory');
      expect(directory.name).toBe('components');
      expect(directory.content).toBe('');
      expect(directory.size).toBe(0);
    });

    it('should maintain file metadata consistency', async () => {
      const beforeTime = new Date();

      const file = await createFile({
        path: '/src/test.ts',
        type: 'file',
        content: 'test content'
      });

      const afterTime = new Date();

      expect(file.lastModified.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(file.lastModified.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(file.size).toBe('test content'.length);
    });
  });

  describe('Health Check Integration', () => {
    it('should provide comprehensive health status', async () => {
      const result = await health();

      expect(result).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: '1.0.0',
        services: expect.arrayContaining([
          'auth',
          'projects',
          'files',
          'ai'
        ]),
        environment: {
          valid: true,
          errors: [],
          warnings: [],
          missingOptional: []
        },
        nodeEnv: 'test'
      });

      // Verify timestamp is valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should check external service readiness', async () => {
      // Mock AI engine health check
      (fetch as any).mockResolvedValue({ ok: true });

      const result = await ready();

      expect(result).toMatchObject({
        status: 'ready',
        services: {
          postgres: 'available',
          redis: 'available',
          ai_engine: 'available'
        },
        timestamp: expect.any(String)
      });

      expect(fetch).toHaveBeenCalledWith('http://localhost:8001/health');
    });

    it('should handle partial service degradation', async () => {
      // Mock AI engine failure
      (fetch as any).mockRejectedValue(new Error('Connection timeout'));

      const result = await ready();

      expect(result.status).toBe('degraded');
      expect(result.services.ai_engine).toBe('unavailable');
      expect(result.services.postgres).toBe('available');
      expect(result.services.redis).toBe('available');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      (fetch as any).mockRejectedValue(timeoutError);

      // AI service should return fallback response
      const aiResult = await generate({
        prompt: 'Test prompt'
      });
      expect(aiResult.content).toContain('AI service temporarily unavailable');

      // Health checks should report service as unavailable
      const readyResult = await ready();
      expect(readyResult.services.ai_engine).toBe('unavailable');
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response
      const malformedResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          // Missing expected fields
          invalid: 'response'
        })
      };

      (fetch as any).mockResolvedValue(malformedResponse);

      const result = await generate({
        prompt: 'Test prompt'
      });

      expect(result.content).toBe('No response from AI');
      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      });
    });

    it('should handle HTTP error codes', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };

      (fetch as any).mockResolvedValue(errorResponse);

      const result = await generate({
        prompt: 'Test prompt'
      });

      expect(result.content).toContain('AI service temporarily unavailable');
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain data consistency across file operations', async () => {
      const fileContent = 'const greeting = "Hello, World!";';
      
      // Create file
      const createdFile = await createFile({
        path: '/src/greeting.ts',
        type: 'file',
        content: fileContent
      });

      expect(createdFile.content).toBe(fileContent);
      expect(createdFile.size).toBe(fileContent.length);

      // Update file
      const newContent = 'const greeting = "Hello, Universe!";';
      const updatedFile = await updateFile({
        id: createdFile.id,
        content: newContent
      });

      expect(updatedFile.content).toBe(newContent);
      expect(updatedFile.size).toBe(newContent.length);
      expect(updatedFile.lastModified.getTime()).toBeGreaterThan(createdFile.lastModified.getTime());
    });

    it('should handle concurrent operations safely', async () => {
      const operations = [
        createFile({
          path: '/src/file1.ts',
          type: 'file',
          content: 'content1'
        }),
        createFile({
          path: '/src/file2.ts',
          type: 'file',
          content: 'content2'
        }),
        createFile({
          path: '/src/file3.ts',
          type: 'file',
          content: 'content3'
        })
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.name).toBe(`file${index + 1}.ts`);
        expect(result.content).toBe(`content${index + 1}`);
      });

      // IDs should be unique
      const ids = results.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large file operations efficiently', async () => {
      const largeContent = 'a'.repeat(100000); // 100KB content

      const startTime = Date.now();
      
      const file = await createFile({
        path: '/src/large-file.ts',
        type: 'file',
        content: largeContent
      });

      const endTime = Date.now();

      expect(file.content).toBe(largeContent);
      expect(file.size).toBe(largeContent.length);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent AI requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
        })
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const requests = Array.from({ length: 5 }, (_, i) => 
        generate({
          prompt: `Request ${i + 1}`,
          model: 'gpt-3.5-turbo'
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.content).toBe('AI response');
      });

      // Should handle concurrent requests efficiently
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect environment variables', async () => {
      const originalUrl = process.env.AI_ENGINE_URL;
      process.env.AI_ENGINE_URL = 'http://custom-ai:9999';

      (fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
      });

      await generate({ prompt: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        'http://custom-ai:9999/generation',
        expect.any(Object)
      );

      // Restore original
      if (originalUrl) {
        process.env.AI_ENGINE_URL = originalUrl;
      } else {
        delete process.env.AI_ENGINE_URL;
      }
    });

    it('should use default configuration when env vars missing', async () => {
      const originalUrl = process.env.AI_ENGINE_URL;
      delete process.env.AI_ENGINE_URL;

      (fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
      });

      await generate({ prompt: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        'http://ai-engine:8001/generation',
        expect.any(Object)
      );

      // Restore original
      if (originalUrl) {
        process.env.AI_ENGINE_URL = originalUrl;
      }
    });
  });
});