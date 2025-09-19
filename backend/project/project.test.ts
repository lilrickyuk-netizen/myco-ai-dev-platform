import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject, listProjects, getProject, updateProject, deleteProject } from './project';
import type { CreateProjectRequest, UpdateProjectRequest } from './types';

vi.mock('~encore/auth', () => ({
  requireUser: vi.fn().mockReturnValue({ id: 'test-user' })
}));

vi.mock('encore.dev/storage/sqldb', () => ({
  SQLDatabase: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    exec: vi.fn()
  }))
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('test-project-id')
}));

describe('Project Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const request: CreateProjectRequest = {
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript'
      };

      // Mock database response
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: 'test-project-id',
          name: 'Test Project',
          description: 'A test project',
          template: 'react-typescript',
          user_id: 'test-user',
          created_at: new Date(),
          updated_at: new Date()
        }]);

      const result = await createProject(request);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('template');
      expect(result.name).toBe(request.name);
      expect(result.template).toBe(request.template);
    });

    it('should validate project name', async () => {
      const request: CreateProjectRequest = {
        name: '',
        template: 'react-typescript'
      };

      await expect(createProject(request)).rejects.toThrow('Project name is required');
    });

    it('should validate template', async () => {
      const request: CreateProjectRequest = {
        name: 'Test Project',
        template: 'invalid-template' as any
      };

      await expect(createProject(request)).rejects.toThrow('Invalid template');
    });

    it('should handle duplicate project name', async () => {
      const request: CreateProjectRequest = {
        name: 'Existing Project',
        template: 'react-typescript'
      };

      // Mock database to simulate existing project
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockRejectedValueOnce(new Error('duplicate key value'));

      await expect(createProject(request)).rejects.toThrow('Project name already exists');
    });
  });

  describe('listProjects', () => {
    it('should list user projects', async () => {
      // Mock database response
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([
          {
            id: 'project-1',
            name: 'Project 1',
            description: 'First project',
            template: 'react-typescript',
            user_id: 'test-user',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'project-2',
            name: 'Project 2',
            description: 'Second project',
            template: 'express-typescript',
            user_id: 'test-user',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]);

      const result = await listProjects();

      expect(Array.isArray(result.projects)).toBe(true);
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].name).toBe('Project 1');
      expect(result.projects[1].name).toBe('Project 2');
    });

    it('should return empty list for user with no projects', async () => {
      // Mock database to return no projects
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([]);

      const result = await listProjects();

      expect(Array.isArray(result.projects)).toBe(true);
      expect(result.projects).toHaveLength(0);
    });
  });

  describe('getProject', () => {
    it('should get project by id', async () => {
      const projectId = 'test-project-id';

      // Mock database response
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: projectId,
          name: 'Test Project',
          description: 'A test project',
          template: 'react-typescript',
          user_id: 'test-user',
          created_at: new Date(),
          updated_at: new Date()
        }]);

      const result = await getProject(projectId);

      expect(result.id).toBe(projectId);
      expect(result.name).toBe('Test Project');
    });

    it('should handle project not found', async () => {
      const projectId = 'non-existent';

      // Mock database to return no project
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([]);

      await expect(getProject(projectId)).rejects.toThrow('Project not found');
    });

    it('should handle unauthorized access', async () => {
      const projectId = 'other-user-project';

      // Mock database to return project owned by different user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: projectId,
          name: 'Other Project',
          user_id: 'other-user'
        }]);

      await expect(getProject(projectId)).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    it('should update project successfully', async () => {
      const projectId = 'test-project-id';
      const request: UpdateProjectRequest = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      // Mock database response
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: projectId,
          name: 'Updated Project',
          description: 'Updated description',
          template: 'react-typescript',
          user_id: 'test-user',
          created_at: new Date(),
          updated_at: new Date()
        }]);

      const result = await updateProject(projectId, request);

      expect(result.name).toBe(request.name);
      expect(result.description).toBe(request.description);
    });

    it('should validate update data', async () => {
      const projectId = 'test-project-id';
      const request: UpdateProjectRequest = {
        name: ''
      };

      await expect(updateProject(projectId, request)).rejects.toThrow('Project name cannot be empty');
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      const projectId = 'test-project-id';

      // Mock database to confirm deletion
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().exec)
        .mockResolvedValueOnce(undefined);

      const result = await deleteProject(projectId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Project deleted successfully');
    });

    it('should handle project not found during deletion', async () => {
      const projectId = 'non-existent';

      // Mock database to simulate no rows affected
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().exec)
        .mockRejectedValueOnce(new Error('Project not found'));

      await expect(deleteProject(projectId)).rejects.toThrow('Project not found');
    });
  });
});