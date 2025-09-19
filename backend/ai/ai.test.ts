import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCode, chat, getModels } from './ai';
import type { GenerateCodeRequest, ChatRequest } from './types';

vi.mock('~encore/auth', () => ({
  requireUser: vi.fn().mockReturnValue({ id: 'test-user' })
}));

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCode', () => {
    it('should generate code successfully', async () => {
      const request: GenerateCodeRequest = {
        prompt: 'Create a React component',
        framework: 'react',
        language: 'typescript'
      };

      const result = await generateCode(request);

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('explanation');
      expect(result.code).toContain('React');
      expect(result.framework).toBe('react');
      expect(result.language).toBe('typescript');
    });

    it('should handle empty prompt', async () => {
      const request: GenerateCodeRequest = {
        prompt: '',
        framework: 'react',
        language: 'typescript'
      };

      await expect(generateCode(request)).rejects.toThrow('Prompt is required');
    });

    it('should handle invalid framework', async () => {
      const request: GenerateCodeRequest = {
        prompt: 'Create a component',
        framework: 'invalid' as any,
        language: 'typescript'
      };

      await expect(generateCode(request)).rejects.toThrow('Unsupported framework');
    });

    it('should handle different languages', async () => {
      const request: GenerateCodeRequest = {
        prompt: 'Create a function',
        framework: 'express',
        language: 'javascript'
      };

      const result = await generateCode(request);

      expect(result.language).toBe('javascript');
      expect(result.code).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should handle chat message successfully', async () => {
      const request: ChatRequest = {
        message: 'How do I create a React component?',
        context: {
          projectId: 'test-project',
          files: []
        }
      };

      const result = await chat(request);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('suggestions');
      expect(result.response).toContain('component');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should handle empty message', async () => {
      const request: ChatRequest = {
        message: '',
        context: {
          projectId: 'test-project',
          files: []
        }
      };

      await expect(chat(request)).rejects.toThrow('Message is required');
    });

    it('should include context in response', async () => {
      const request: ChatRequest = {
        message: 'Help with this file',
        context: {
          projectId: 'test-project',
          files: [{
            path: 'src/App.tsx',
            content: 'import React from "react";'
          }]
        }
      };

      const result = await chat(request);

      expect(result.response).toBeDefined();
      expect(result.contextUsed).toBe(true);
    });
  });

  describe('getModels', () => {
    it('should return available models', async () => {
      const result = await getModels();

      expect(Array.isArray(result.models)).toBe(true);
      expect(result.models.length).toBeGreaterThan(0);
      expect(result.models[0]).toHaveProperty('id');
      expect(result.models[0]).toHaveProperty('name');
      expect(result.models[0]).toHaveProperty('capabilities');
    });

    it('should include model capabilities', async () => {
      const result = await getModels();

      const codeModel = result.models.find(m => m.capabilities.includes('code-generation'));
      expect(codeModel).toBeDefined();

      const chatModel = result.models.find(m => m.capabilities.includes('chat'));
      expect(chatModel).toBeDefined();
    });
  });
});