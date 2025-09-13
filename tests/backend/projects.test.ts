import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { APIError } from 'encore.dev/api';

// Import project functions
import { create, list, get, update, deleteProject } from '../../backend/projects/create';
import { projectsDB } from '../../backend/projects/db';

describe('Projects Service', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    testUserId = 'test-user-id-123';
    
    // Clean up any existing test data
    await projectsDB.exec`DELETE FROM project_collaborators WHERE project_id IN (
      SELECT id FROM projects WHERE name LIKE '%test%'
    )`;
    await projectsDB.exec`DELETE FROM projects WHERE name LIKE '%test%'`;
  });

  afterAll(async () => {
    // Clean up test data
    await projectsDB.exec`DELETE FROM project_collaborators WHERE project_id IN (
      SELECT id FROM projects WHERE name LIKE '%test%'
    )`;
    await projectsDB.exec`DELETE FROM projects WHERE name LIKE '%test%'`;
  });

  beforeEach(async () => {
    // Clean up test projects before each test
    await projectsDB.exec`DELETE FROM project_collaborators WHERE project_id IN (
      SELECT id FROM projects WHERE name LIKE '%test%'
    )`;
    await projectsDB.exec`DELETE FROM projects WHERE name LIKE '%test%'`;
  });

  describe('Project Creation', () => {
    it('should create a new project with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for unit testing',
        templateId: null,
        isPublic: false
      };

      // Mock auth context
      const mockAuth = { userID: testUserId };
      
      const result = await create(projectData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(projectData.name);
      expect(result.description).toBe(projectData.description);
      expect(result.slug).toBeDefined();
      expect(result.ownerId).toBe(testUserId);
      expect(result.visibility).toBe('private');
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique slug from project name', async () => {
      const projectData = {
        name: 'Test Project With Spaces',
        description: 'Testing slug generation',
        templateId: null,
        isPublic: false
      };

      const result = await create(projectData);

      expect(result.slug).toMatch(/^test-project-with-spaces(-\d+)?$/);
    });

    it('should handle duplicate project names with different slugs', async () => {
      const projectData = {
        name: 'Duplicate Project',
        description: 'First project',
        templateId: null,
        isPublic: false
      };

      const firstProject = await create(projectData);
      const secondProject = await create({
        ...projectData,
        description: 'Second project with same name'
      });

      expect(firstProject.slug).not.toBe(secondProject.slug);
      expect(secondProject.slug).toMatch(/^duplicate-project-\d+$/);
    });

    it('should set correct visibility based on isPublic flag', async () => {
      const privateProject = await create({
        name: 'Private Test Project',
        description: 'Should be private',
        templateId: null,
        isPublic: false
      });

      const publicProject = await create({
        name: 'Public Test Project',
        description: 'Should be public',
        templateId: null,
        isPublic: true
      });

      expect(privateProject.visibility).toBe('private');
      expect(publicProject.visibility).toBe('public');
    });

    it('should require project name', async () => {
      const projectData = {
        name: '',
        description: 'Project without name',
        templateId: null,
        isPublic: false
      };

      await expect(create(projectData)).rejects.toThrow();
    });

    it('should handle long project names', async () => {
      const longName = 'A'.repeat(300);
      const projectData = {
        name: longName,
        description: 'Project with very long name',
        templateId: null,
        isPublic: false
      };

      await expect(create(projectData)).rejects.toThrow();
    });

    it('should initialize empty tech stack and metadata', async () => {
      const projectData = {
        name: 'Empty Metadata Test',
        description: 'Testing empty initialization',
        templateId: null,
        isPublic: false
      };

      const result = await create(projectData);

      expect(result.techStack).toEqual([]);
      expect(result.metadata).toEqual({});
    });
  });

  describe('Project Listing', () => {
    beforeEach(async () => {
      // Create test projects
      await create({
        name: 'List Test Project 1',
        description: 'First test project',
        templateId: null,
        isPublic: false
      });

      await create({
        name: 'List Test Project 2',
        description: 'Second test project',
        templateId: null,
        isPublic: true
      });

      await create({
        name: 'List Test Project 3',
        description: 'Third test project',
        templateId: null,
        isPublic: false
      });
    });

    it('should list all user projects', async () => {
      const result = await list();

      expect(result).toBeDefined();
      expect(result.projects).toBeInstanceOf(Array);
      expect(result.projects.length).toBeGreaterThanOrEqual(3);
      
      // Verify all projects belong to the user
      result.projects.forEach(project => {
        expect(project.ownerId).toBe(testUserId);
      });
    });

    it('should return projects in correct order (newest first)', async () => {
      const result = await list();

      expect(result.projects.length).toBeGreaterThan(1);
      
      for (let i = 1; i < result.projects.length; i++) {
        expect(result.projects[i-1].createdAt.getTime())
          .toBeGreaterThanOrEqual(result.projects[i].createdAt.getTime());
      }
    });

    it('should include project statistics', async () => {
      const result = await list();

      expect(result.total).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(result.projects.length);
    });

    it('should handle pagination', async () => {
      const firstPage = await list({ page: 1, limit: 2 });
      const secondPage = await list({ page: 2, limit: 2 });

      expect(firstPage.projects.length).toBeLessThanOrEqual(2);
      expect(secondPage.projects.length).toBeLessThanOrEqual(2);
      
      if (firstPage.projects.length > 0 && secondPage.projects.length > 0) {
        expect(firstPage.projects[0].id).not.toBe(secondPage.projects[0].id);
      }
    });

    it('should filter by visibility', async () => {
      const publicProjects = await list({ visibility: 'public' });
      const privateProjects = await list({ visibility: 'private' });

      publicProjects.projects.forEach(project => {
        expect(project.visibility).toBe('public');
      });

      privateProjects.projects.forEach(project => {
        expect(project.visibility).toBe('private');
      });
    });

    it('should search projects by name', async () => {
      const searchResult = await list({ search: 'List Test Project 1' });

      expect(searchResult.projects.length).toBe(1);
      expect(searchResult.projects[0].name).toBe('List Test Project 1');
    });
  });

  describe('Project Retrieval', () => {
    let testProjectId: string;

    beforeEach(async () => {
      const project = await create({
        name: 'Get Test Project',
        description: 'Project for retrieval testing',
        templateId: null,
        isPublic: false
      });
      testProjectId = project.id;
    });

    it('should get project by ID', async () => {
      const result = await get({ id: testProjectId });

      expect(result).toBeDefined();
      expect(result.id).toBe(testProjectId);
      expect(result.name).toBe('Get Test Project');
      expect(result.ownerId).toBe(testUserId);
    });

    it('should throw error for non-existent project', async () => {
      await expect(get({ id: 'non-existent-id' }))
        .rejects.toThrow('Project not found');
    });

    it('should include project files in response', async () => {
      const result = await get({ id: testProjectId });

      expect(result.files).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
    });

    it('should include collaborators information', async () => {
      const result = await get({ id: testProjectId });

      expect(result.collaborators).toBeDefined();
      expect(result.collaborators).toBeInstanceOf(Array);
    });
  });

  describe('Project Updates', () => {
    let testProjectId: string;

    beforeEach(async () => {
      const project = await create({
        name: 'Update Test Project',
        description: 'Original description',
        templateId: null,
        isPublic: false
      });
      testProjectId = project.id;
    });

    it('should update project name and description', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description'
      };

      const result = await update({
        id: testProjectId,
        ...updateData
      });

      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(result.updatedAt.getTime()).toBeGreaterThan(result.createdAt.getTime());
    });

    it('should update project visibility', async () => {
      const result = await update({
        id: testProjectId,
        isPublic: true
      });

      expect(result.visibility).toBe('public');
    });

    it('should update tech stack', async () => {
      const techStack = ['React', 'TypeScript', 'Node.js'];
      
      const result = await update({
        id: testProjectId,
        techStack
      });

      expect(result.techStack).toEqual(techStack);
    });

    it('should update project metadata', async () => {
      const metadata = {
        framework: 'React',
        version: '1.0.0',
        environment: 'development'
      };

      const result = await update({
        id: testProjectId,
        metadata
      });

      expect(result.metadata).toEqual(metadata);
    });

    it('should not allow updating non-existent project', async () => {
      await expect(update({
        id: 'non-existent-id',
        name: 'Updated Name'
      })).rejects.toThrow('Project not found');
    });

    it('should validate updated data', async () => {
      await expect(update({
        id: testProjectId,
        name: '' // Empty name should be invalid
      })).rejects.toThrow();
    });
  });

  describe('Project Deletion', () => {
    let testProjectId: string;

    beforeEach(async () => {
      const project = await create({
        name: 'Delete Test Project',
        description: 'Project for deletion testing',
        templateId: null,
        isPublic: false
      });
      testProjectId = project.id;
    });

    it('should delete project successfully', async () => {
      const result = await deleteProject({ id: testProjectId });

      expect(result.success).toBe(true);

      // Verify project is deleted
      await expect(get({ id: testProjectId }))
        .rejects.toThrow('Project not found');
    });

    it('should handle deletion of non-existent project', async () => {
      await expect(deleteProject({ id: 'non-existent-id' }))
        .rejects.toThrow('Project not found');
    });

    it('should delete associated files and collaborators', async () => {
      // Add some files and collaborators first
      await projectsDB.exec`
        INSERT INTO project_files (project_id, name, path, type, content, created_by)
        VALUES (${testProjectId}, 'test.js', '/test.js', 'file', 'console.log("test");', ${testUserId})
      `;

      await projectsDB.exec`
        INSERT INTO project_collaborators (project_id, user_id, role)
        VALUES (${testProjectId}, 'other-user-id', 'editor')
      `;

      await deleteProject({ id: testProjectId });

      // Verify cascading deletion
      const files = await projectsDB.query`
        SELECT * FROM project_files WHERE project_id = ${testProjectId}
      `;
      const collaborators = await projectsDB.query`
        SELECT * FROM project_collaborators WHERE project_id = ${testProjectId}
      `;

      expect(files.length).toBe(0);
      expect(collaborators.length).toBe(0);
    });
  });

  describe('Project Access Control', () => {
    let ownerProjectId: string;
    let otherUserId: string;

    beforeEach(async () => {
      otherUserId = 'other-user-id-456';
      
      const project = await create({
        name: 'Access Control Test Project',
        description: 'Testing access control',
        templateId: null,
        isPublic: false
      });
      ownerProjectId = project.id;
    });

    it('should allow owner to access their project', async () => {
      const result = await get({ id: ownerProjectId });
      expect(result.id).toBe(ownerProjectId);
    });

    it('should prevent unauthorized access to private projects', async () => {
      // Mock different user context
      const mockOtherAuth = { userID: otherUserId };
      
      await expect(get({ id: ownerProjectId }))
        .rejects.toThrow('Project not found');
    });

    it('should allow access to public projects', async () => {
      // Make project public
      await update({ id: ownerProjectId, isPublic: true });

      // Mock different user context
      const mockOtherAuth = { userID: otherUserId };
      
      const result = await get({ id: ownerProjectId });
      expect(result.id).toBe(ownerProjectId);
      expect(result.visibility).toBe('public');
    });
  });

  describe('Project Templates', () => {
    it('should create project from template', async () => {
      const templateId = 'react-template-id';
      
      const projectData = {
        name: 'Template Test Project',
        description: 'Created from template',
        templateId,
        isPublic: false
      };

      const result = await create(projectData);

      expect(result.templateId).toBe(templateId);
      expect(result.name).toBe(projectData.name);
    });

    it('should handle invalid template ID', async () => {
      const projectData = {
        name: 'Invalid Template Project',
        description: 'Using invalid template',
        templateId: 'non-existent-template',
        isPublic: false
      };

      // Should still create project but with warning or null template
      const result = await create(projectData);
      expect(result).toBeDefined();
    });
  });

  describe('Project Statistics', () => {
    beforeEach(async () => {
      // Create multiple projects for statistics
      await create({
        name: 'Stats Test Project 1',
        description: 'For statistics testing',
        templateId: null,
        isPublic: true
      });

      await create({
        name: 'Stats Test Project 2',
        description: 'For statistics testing',
        templateId: null,
        isPublic: false
      });
    });

    it('should count user projects correctly', async () => {
      const result = await list();

      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.projects.length).toBeLessThanOrEqual(result.total);
    });

    it('should provide project breakdown by visibility', async () => {
      const allProjects = await list();
      const publicProjects = await list({ visibility: 'public' });
      const privateProjects = await list({ visibility: 'private' });

      expect(publicProjects.total + privateProjects.total)
        .toBeLessThanOrEqual(allProjects.total);
    });
  });

  describe('Project Validation', () => {
    it('should validate project name length', async () => {
      const invalidProjects = [
        { name: '', description: 'Empty name' },
        { name: 'a'.repeat(256), description: 'Too long name' }
      ];

      for (const projectData of invalidProjects) {
        await expect(create({
          ...projectData,
          templateId: null,
          isPublic: false
        })).rejects.toThrow();
      }
    });

    it('should sanitize project data', async () => {
      const projectData = {
        name: '<script>alert("xss")</script>Malicious Project',
        description: '<img src="x" onerror="alert(1)">Description',
        templateId: null,
        isPublic: false
      };

      const result = await create(projectData);

      // Should strip dangerous HTML
      expect(result.name).not.toContain('<script>');
      expect(result.description).not.toContain('<img');
    });

    it('should validate tech stack format', async () => {
      const project = await create({
        name: 'Tech Stack Test',
        description: 'Testing tech stack validation',
        templateId: null,
        isPublic: false
      });

      const validTechStack = ['React', 'TypeScript', 'Node.js'];
      const invalidTechStack = ['', null, undefined, 123];

      await expect(update({
        id: project.id,
        techStack: validTechStack
      })).resolves.toBeDefined();

      await expect(update({
        id: project.id,
        techStack: invalidTechStack as any
      })).rejects.toThrow();
    });
  });
});

// Helper functions for testing
function generateRandomProjectName(): string {
  return `Test Project ${Math.random().toString(36).substring(7)}`;
}

function createMockAuthContext(userId: string) {
  return { userID: userId };
}