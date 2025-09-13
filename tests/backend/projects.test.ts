import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app from '../../backend/src/app';
import { setupTestDatabase, teardownTestDatabase } from '../utils/database';

describe('Projects API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.description).toBe(projectData.description);
      expect(response.body.template).toBe(projectData.template);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should validate project name format', async () => {
      const projectData = {
        name: '', // Empty name
        description: 'A test project',
        template: 'react-typescript',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(400);

      expect(response.body.error).toContain('name');
    });

    it('should validate template exists', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'invalid-template',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(400);

      expect(response.body.error).toContain('template');
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should return list of projects', async () => {
      // Create test projects
      const project1 = {
        name: 'Project 1',
        description: 'First project',
        template: 'react-typescript',
      };
      const project2 = {
        name: 'Project 2',
        description: 'Second project',
        template: 'express-typescript',
      };

      await request(app).post('/api/v1/projects').send(project1);
      await request(app).post('/api/v1/projects').send(project2);

      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[1]).toHaveProperty('id');
      expect(response.body[1]).toHaveProperty('name');
    });

    it('should return empty array when no projects exist', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should support pagination', async () => {
      // Create multiple projects
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/v1/projects')
          .send({
            name: `Project ${i}`,
            description: `Project ${i} description`,
            template: 'react-typescript',
          });
      }

      const response = await request(app)
        .get('/api/v1/projects?page=1&limit=2')
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(5);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return project by id', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send(projectData);

      const projectId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.description).toBe(projectData.description);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/v1/projects/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for invalid project id', async () => {
      const response = await request(app)
        .get('/api/v1/projects/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send(projectData);

      const projectId = createResponse.body.id;

      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.template).toBe(projectData.template); // Should remain unchanged
    });

    it('should return 404 for non-existent project', async () => {
      const updateData = {
        name: 'Updated Project',
      };

      const response = await request(app)
        .put('/api/v1/projects/99999')
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate update data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send(projectData);

      const projectId = createResponse.body.id;

      const invalidUpdateData = {
        name: '', // Empty name should be invalid
      };

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send(projectData);

      const projectId = createResponse.body.id;

      await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(204);

      // Verify project is deleted
      await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(404);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/api/v1/projects/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for project operations', async () => {
      // Test without auth token
      await request(app)
        .post('/api/v1/projects')
        .send({
          name: 'Test Project',
          description: 'A test project',
          template: 'react-typescript',
        })
        .expect(401);

      await request(app)
        .get('/api/v1/projects')
        .expect(401);
    });

    it('should reject invalid auth tokens', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          name: 'Test Project',
          description: 'A test project',
          template: 'react-typescript',
        })
        .expect(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
      };

      // Make multiple requests rapidly
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/projects')
          .send(projectData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'A test project with <img src=x onerror=alert(1)>',
        template: 'react-typescript',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .send(maliciousData)
        .expect(201);

      // Check that script tags are removed/sanitized
      expect(response.body.name).not.toContain('<script>');
      expect(response.body.description).not.toContain('<img');
    });
  });
});