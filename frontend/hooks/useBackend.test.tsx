import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBackend } from './useBackend';

// Mock the backend client
vi.mock('~backend/client', () => ({
  default: {
    project: {
      listProjects: vi.fn(),
      getProject: vi.fn(),
      createProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn()
    },
    filesystem: {
      listFiles: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn()
    },
    ai: {
      generateCode: vi.fn(),
      chat: vi.fn()
    }
  }
}));

describe('useBackend', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('projects', () => {
    it('should fetch projects list', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', template: 'react' },
        { id: '2', name: 'Project 2', template: 'express' }
      ];

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.listProjects).mockResolvedValue({
        projects: mockProjects
      });

      const { result } = renderHook(() => useBackend().projects.list(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.projects).toEqual(mockProjects);
    });

    it('should fetch single project', async () => {
      const mockProject = {
        id: 'test-project',
        name: 'Test Project',
        template: 'react-typescript'
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.getProject).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useBackend().projects.get('test-project'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProject);
    });

    it('should create new project', async () => {
      const newProject = {
        id: 'new-project',
        name: 'New Project',
        template: 'react-typescript'
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.createProject).mockResolvedValue(newProject);

      const { result } = renderHook(() => useBackend().projects.create(), { wrapper });

      result.current.mutate({
        name: 'New Project',
        template: 'react-typescript'
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(newProject);
    });

    it('should update project', async () => {
      const updatedProject = {
        id: 'project-1',
        name: 'Updated Project',
        description: 'Updated description'
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.updateProject).mockResolvedValue(updatedProject);

      const { result } = renderHook(() => useBackend().projects.update(), { wrapper });

      result.current.mutate({
        projectId: 'project-1',
        data: { name: 'Updated Project', description: 'Updated description' }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(updatedProject);
    });

    it('should delete project', async () => {
      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.deleteProject).mockResolvedValue({
        success: true,
        message: 'Project deleted'
      });

      const { result } = renderHook(() => useBackend().projects.delete(), { wrapper });

      result.current.mutate('project-to-delete');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        success: true,
        message: 'Project deleted'
      });
    });
  });

  describe('filesystem', () => {
    it('should list files', async () => {
      const mockFiles = [
        { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
        { name: 'components', type: 'directory', path: 'src/components' }
      ];

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
        files: mockFiles
      });

      const { result } = renderHook(
        () => useBackend().filesystem.listFiles('project-1', 'src'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.files).toEqual(mockFiles);
    });

    it('should read file content', async () => {
      const mockFile = {
        content: 'import React from "react";',
        path: 'src/App.tsx',
        isBinary: false
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.filesystem.readFile).mockResolvedValue(mockFile);

      const { result } = renderHook(
        () => useBackend().filesystem.readFile('project-1', 'src/App.tsx'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockFile);
    });

    it('should write file', async () => {
      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.filesystem.writeFile).mockResolvedValue({
        success: true,
        path: 'src/NewFile.tsx'
      });

      const { result } = renderHook(() => useBackend().filesystem.writeFile(), { wrapper });

      result.current.mutate({
        projectId: 'project-1',
        data: {
          path: 'src/NewFile.tsx',
          content: 'console.log("hello");'
        }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        success: true,
        path: 'src/NewFile.tsx'
      });
    });
  });

  describe('ai', () => {
    it('should generate code', async () => {
      const mockResult = {
        code: 'function HelloWorld() { return <div>Hello</div>; }',
        explanation: 'A simple React component',
        framework: 'react',
        language: 'typescript'
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.ai.generateCode).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useBackend().ai.generateCode(), { wrapper });

      result.current.mutate({
        prompt: 'Create a React component',
        framework: 'react',
        language: 'typescript'
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResult);
    });

    it('should handle chat', async () => {
      const mockResult = {
        response: 'Here is how to create a React component...',
        suggestions: ['Create component', 'Add props', 'Add state'],
        contextUsed: true
      };

      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.ai.chat).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useBackend().ai.chat(), { wrapper });

      result.current.mutate({
        message: 'How do I create a React component?',
        context: {
          projectId: 'project-1',
          files: []
        }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResult);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.listProjects).mockRejectedValue(
        new Error('API Error')
      );

      const { result } = renderHook(() => useBackend().projects.list(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('API Error'));
    });

    it('should handle network errors', async () => {
      const mockBackend = await import('~backend/client');
      vi.mocked(mockBackend.default.project.getProject).mockRejectedValue(
        new Error('Network Error')
      );

      const { result } = renderHook(() => useBackend().projects.get('project-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Network Error'));
    });
  });

  describe('loading states', () => {
    it('should show loading state for queries', () => {
      const mockBackend = import('~backend/client');
      // Don't resolve to simulate loading

      const { result } = renderHook(() => useBackend().projects.list(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should show loading state for mutations', () => {
      const { result } = renderHook(() => useBackend().projects.create(), { wrapper });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isIdle).toBe(true);
    });
  });
});