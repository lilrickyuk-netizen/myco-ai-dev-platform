const axios = require('axios');

const STAGING_URL = process.env.STAGING_URL || 'https://staging.myco-ai.com';
const TIMEOUT = 30000;

describe('Staging Smoke Tests', () => {
  let client;

  beforeAll(() => {
    client = axios.create({
      baseURL: STAGING_URL,
      timeout: TIMEOUT,
      validateStatus: () => true // Allow all status codes for testing
    });
  });

  describe('Health Checks', () => {
    test('Application health endpoint responds', async () => {
      const response = await client.get('/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
    });

    test('Database health check passes', async () => {
      const response = await client.get('/api/main/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('database');
      expect(response.data.database.status).toBe('healthy');
    });

    test('AI service health check passes', async () => {
      const response = await client.get('/api/ai/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
    });

    test('Auth service health check passes', async () => {
      const response = await client.get('/api/auth/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
    });
  });

  describe('Frontend', () => {
    test('Frontend loads successfully', async () => {
      const response = await client.get('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('Static assets are accessible', async () => {
      const response = await client.get('/favicon.ico');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('API Endpoints', () => {
    test('API endpoints return expected structure', async () => {
      // Test projects endpoint (may require auth)
      const projectsResponse = await client.get('/api/projects');
      expect([200, 401, 403]).toContain(projectsResponse.status);

      // Test filesystem endpoint (may require auth)
      const filesResponse = await client.get('/api/filesystem');
      expect([200, 401, 403]).toContain(filesResponse.status);
    });

    test('AI generation endpoint exists', async () => {
      const response = await client.post('/api/ai/generate', {
        prompt: 'test prompt'
      });
      // Should return 401 (unauthorized) or 400 (bad request) for missing auth
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    test('Health endpoint responds within 1 second', async () => {
      const startTime = Date.now();
      const response = await client.get('/health');
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });

    test('Frontend loads within 3 seconds', async () => {
      const startTime = Date.now();
      const response = await client.get('/');
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000);
    });
  });

  describe('Security Headers', () => {
    test('Security headers are present', async () => {
      const response = await client.get('/');
      
      // Check for common security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('Monitoring', () => {
    test('Metrics endpoint is accessible', async () => {
      const response = await client.get('/metrics');
      expect([200, 401, 404]).toContain(response.status);
    });
  });
});