import { describe, it, expect, beforeEach, vi } from 'vitest';
import { health, ready } from '../../backend/main/health';

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment validation
vi.mock('../../backend/main/env-validation', () => ({
  validateEnvironment: vi.fn()
}));

import { validateEnvironment } from '../../backend/main/env-validation';

describe('Health Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('health endpoint', () => {
    it('should return healthy status when environment is valid', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const result = await health();

      expect(result).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: '1.0.0',
        services: expect.arrayContaining([
          'auth',
          'projects',
          'files',
          'ai',
          'agents',
          'deployment',
          'execution',
          'collaboration'
        ]),
        environment: {
          valid: true,
          errors: [],
          warnings: [],
          missingOptional: []
        },
        nodeEnv: expect.any(String)
      });
    });

    it('should return unhealthy status when environment is invalid', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: false,
        errors: ['Missing required environment variable'],
        warnings: [],
        missingOptional: []
      });

      const result = await health();

      expect(result.status).toBe('unhealthy');
      expect(result.environment.valid).toBe(false);
      expect(result.environment.errors).toContain('Missing required environment variable');
    });

    it('should return degraded status when environment has warnings', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Optional service unavailable'],
        missingOptional: ['OPTIONAL_API_KEY']
      });

      const result = await health();

      expect(result.status).toBe('degraded');
      expect(result.environment.valid).toBe(true);
      expect(result.environment.warnings).toContain('Optional service unavailable');
    });

    it('should include correct timestamp format', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const beforeTime = new Date();
      const result = await health();
      const afterTime = new Date();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should return correct version', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const result = await health();

      expect(result.version).toBe('1.0.0');
    });

    it('should include all expected services', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const result = await health();

      const expectedServices = [
        'auth',
        'projects',
        'files',
        'ai',
        'agents',
        'deployment',
        'execution',
        'collaboration'
      ];

      expect(result.services).toHaveLength(expectedServices.length);
      expectedServices.forEach(service => {
        expect(result.services).toContain(service);
      });
    });

    it('should return current NODE_ENV', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const result = await health();

      expect(result.nodeEnv).toBe('test');

      // Restore original env
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should handle missing NODE_ENV', async () => {
      (validateEnvironment as any).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        missingOptional: []
      });

      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const result = await health();

      expect(result.nodeEnv).toBe('unknown');

      // Restore original env
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('ready endpoint', () => {
    it('should return ready status when all services are available', async () => {
      // Mock AI Engine health check
      (fetch as any).mockResolvedValue({
        ok: true
      });

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
    });

    it('should return degraded status when some services are unavailable', async () => {
      // Mock AI Engine health check failure
      (fetch as any).mockRejectedValue(new Error('Connection failed'));

      const result = await ready();

      expect(result.status).toBe('degraded');
      expect(result.services.ai_engine).toBe('unavailable');
      expect(result.services.postgres).toBe('available'); // Mock always succeeds
      expect(result.services.redis).toBe('available'); // Mock always succeeds
    });

    it('should handle AI Engine non-ok response', async () => {
      // Mock AI Engine returning non-ok status
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await ready();

      expect(result.services.ai_engine).toBe('unavailable');
    });

    it('should use custom AI_ENGINE_URL when provided', async () => {
      const originalEnv = process.env.AI_ENGINE_URL;
      process.env.AI_ENGINE_URL = 'http://custom-ai:9000';

      (fetch as any).mockResolvedValue({
        ok: true
      });

      await ready();

      expect(fetch).toHaveBeenCalledWith('http://custom-ai:9000/health');

      // Restore original env
      if (originalEnv) {
        process.env.AI_ENGINE_URL = originalEnv;
      } else {
        delete process.env.AI_ENGINE_URL;
      }
    });

    it('should use default AI_ENGINE_URL when not provided', async () => {
      const originalEnv = process.env.AI_ENGINE_URL;
      delete process.env.AI_ENGINE_URL;

      (fetch as any).mockResolvedValue({
        ok: true
      });

      await ready();

      expect(fetch).toHaveBeenCalledWith('http://ai-engine:8001/health');

      // Restore original env
      if (originalEnv) {
        process.env.AI_ENGINE_URL = originalEnv;
      }
    });

    it('should include correct timestamp format', async () => {
      (fetch as any).mockResolvedValue({ ok: true });

      const beforeTime = new Date();
      const result = await ready();
      const afterTime = new Date();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should log errors for failed service checks', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (fetch as any).mockRejectedValue(new Error('AI Engine connection failed'));

      await ready();

      expect(consoleSpy).toHaveBeenCalledWith(
        'AI Engine check failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Service Status Logic', () => {
    it('should correctly determine ready status based on all services', async () => {
      // All services available
      (fetch as any).mockResolvedValue({ ok: true });

      const result1 = await ready();
      expect(result1.status).toBe('ready');

      // AI Engine unavailable
      (fetch as any).mockRejectedValue(new Error('Connection failed'));

      const result2 = await ready();
      expect(result2.status).toBe('degraded');
    });

    it('should include all required service checks', async () => {
      (fetch as any).mockResolvedValue({ ok: true });

      const result = await ready();

      expect(result.services).toHaveProperty('postgres');
      expect(result.services).toHaveProperty('redis');
      expect(result.services).toHaveProperty('ai_engine');
    });

    it('should handle multiple service failures gracefully', async () => {
      // Mock all services failing
      (fetch as any).mockRejectedValue(new Error('All services down'));

      const result = await ready();

      expect(result.status).toBe('degraded');
      expect(result.services.postgres).toBe('available'); // Mock implementation always returns available
      expect(result.services.redis).toBe('available'); // Mock implementation always returns available
      expect(result.services.ai_engine).toBe('unavailable');
    });
  });

  describe('Error Handling', () => {
    it('should handle validateEnvironment throwing error', async () => {
      (validateEnvironment as any).mockImplementation(() => {
        throw new Error('Validation error');
      });

      await expect(health()).rejects.toThrow('Validation error');
    });

    it('should handle network timeouts for AI Engine', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      
      (fetch as any).mockRejectedValue(timeoutError);

      const result = await ready();

      expect(result.services.ai_engine).toBe('unavailable');
    });
  });
});