import { describe, it, expect, vi, beforeEach } from 'vitest';
import { health, status } from './health';

vi.mock('encore.dev/storage/sqldb', () => ({
  SQLDatabase: vi.fn().mockImplementation(() => ({
    query: vi.fn()
  }))
}));

describe('Health Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('health', () => {
    it('should return healthy status', async () => {
      // Mock successful database connection
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{ now: new Date() }]);

      const result = await health();

      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result.services.database).toBe('healthy');
    });

    it('should return unhealthy status when database fails', async () => {
      // Mock database connection failure
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockRejectedValueOnce(new Error('Connection failed'));

      const result = await health();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('unhealthy');
    });

    it('should include service details', async () => {
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{ now: new Date() }]);

      const result = await health();

      expect(result).toHaveProperty('services');
      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('auth');
      expect(result.services).toHaveProperty('projects');
      expect(result.services).toHaveProperty('filesystem');
      expect(result.services).toHaveProperty('ai');
    });
  });

  describe('status', () => {
    it('should return basic status', async () => {
      const result = await status();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result.status).toBe('ok');
    });

    it('should be faster than full health check', async () => {
      const start = Date.now();
      await status();
      const statusTime = Date.now() - start;

      const healthStart = Date.now();
      await health();
      const healthTime = Date.now() - healthStart;

      expect(statusTime).toBeLessThan(healthTime);
    });
  });
});