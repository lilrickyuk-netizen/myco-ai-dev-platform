import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generate, chat } from '../../backend/ai/ai';
import type { GenerateRequest, ChatMessage } from '../../backend/ai/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('generate', () => {
    it('should generate AI response successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Generated AI response'
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        })
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Generate a hello world function',
        model: 'gpt-4'
      };

      const result = await generate(request);

      expect(result).toEqual({
        content: 'Generated AI response',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://ai-engine:8001/generation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Generate a hello world function',
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Generate a hello world function' }]
          })
        }
      );
    });

    it('should use default model when not specified', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      await generate(request);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-3.5-turbo"')
        })
      );
    });

    it('should handle AI engine error response', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      const result = await generate(request);

      expect(result.content).toContain('AI service temporarily unavailable');
      expect(result.content).toContain('Test prompt');
      expect(result.usage.promptTokens).toBeGreaterThan(0);
    });

    it('should handle network error', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      const result = await generate(request);

      expect(result.content).toContain('AI service temporarily unavailable');
      expect(result.content).toContain('Test prompt');
    });

    it('should handle API response with error field', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid API key'
        })
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      const result = await generate(request);

      expect(result.content).toContain('AI service temporarily unavailable');
    });

    it('should handle missing response data gracefully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      const result = await generate(request);

      expect(result.content).toBe('No response from AI');
      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      });
    });

    it('should use custom AI_ENGINE_URL when provided', async () => {
      const originalEnv = process.env.AI_ENGINE_URL;
      process.env.AI_ENGINE_URL = 'http://custom-ai:9000';

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        })
      };

      (fetch as any).mockResolvedValue(mockResponse);

      const request: GenerateRequest = {
        prompt: 'Test prompt'
      };

      await generate(request);

      expect(fetch).toHaveBeenCalledWith(
        'http://custom-ai:9000/generation',
        expect.any(Object)
      );

      // Restore original env
      if (originalEnv) {
        process.env.AI_ENGINE_URL = originalEnv;
      } else {
        delete process.env.AI_ENGINE_URL;
      }
    });

    it('should calculate stub token usage based on prompt length', async () => {
      (fetch as any).mockRejectedValue(new Error('Service unavailable'));

      const longPrompt = 'a'.repeat(400); // 400 characters
      const request: GenerateRequest = {
        prompt: longPrompt
      };

      const result = await generate(request);

      expect(result.usage.promptTokens).toBe(100); // 400 / 4 = 100
      expect(result.usage.completionTokens).toBe(50);
      expect(result.usage.totalTokens).toBe(150);
    });
  });

  describe('chat', () => {
    it('should return mock chat response', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date()
        }
      ];

      const result = await chat({ messages });

      expect(result).toMatchObject({
        role: 'assistant',
        content: expect.stringContaining('Hello, how are you?'),
        timestamp: expect.any(Date)
      });
      expect(result.id).toBeDefined();
    });

    it('should handle empty messages array', async () => {
      const messages: ChatMessage[] = [];

      const result = await chat({ messages });

      expect(result).toMatchObject({
        role: 'assistant',
        content: expect.stringContaining('your message'),
        timestamp: expect.any(Date)
      });
    });

    it('should respond to the last message in the array', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'First message',
          timestamp: new Date()
        },
        {
          id: '2',
          role: 'assistant',
          content: 'First response',
          timestamp: new Date()
        },
        {
          id: '3',
          role: 'user',
          content: 'Second message',
          timestamp: new Date()
        }
      ];

      const result = await chat({ messages });

      expect(result.content).toContain('Second message');
      expect(result.content).not.toContain('First message');
    });

    it('should generate unique message IDs', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date()
        }
      ];

      const result1 = await chat({ messages });
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result2 = await chat({ messages });

      expect(result1.id).not.toBe(result2.id);
    });

    it('should always return assistant role', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date()
        }
      ];

      const result = await chat({ messages });

      expect(result.role).toBe('assistant');
    });

    it('should include current timestamp', async () => {
      const beforeTime = new Date();
      
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date()
        }
      ];

      const result = await chat({ messages });
      
      const afterTime = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});