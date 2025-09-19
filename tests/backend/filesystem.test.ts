import { describe, it, expect, beforeEach } from 'vitest';
import { listFiles, getFile, createFile, updateFile, deleteFile } from '../../backend/filesystem/filesystem';
import type { CreateFileRequest, UpdateFileRequest } from '../../backend/filesystem/types';

describe('Filesystem Service', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  describe('listFiles', () => {
    it('should return file structure for a project', async () => {
      const result = await listFiles({ projectId: 'test-project-1' });

      expect(result).toHaveProperty('files');
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should return files with correct structure', async () => {
      const result = await listFiles({ projectId: 'test-project-1' });

      const srcDir = result.files.find(f => f.name === 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir?.type).toBe('directory');
      expect(srcDir?.path).toBe('/src');
      expect(srcDir?.children).toBeDefined();
      expect(Array.isArray(srcDir?.children)).toBe(true);
    });

    it('should include App.tsx file in src directory', async () => {
      const result = await listFiles({ projectId: 'test-project-1' });

      const srcDir = result.files.find(f => f.name === 'src');
      const appFile = srcDir?.children?.find(f => f.name === 'App.tsx');

      expect(appFile).toBeDefined();
      expect(appFile?.type).toBe('file');
      expect(appFile?.path).toBe('/src/App.tsx');
      expect(appFile?.content).toContain('React');
      expect(appFile?.size).toBe(95);
      expect(appFile?.lastModified).toBeInstanceOf(Date);
    });

    it('should handle different project IDs', async () => {
      const result1 = await listFiles({ projectId: 'project-1' });
      const result2 = await listFiles({ projectId: 'project-2' });

      // Should return the same mock data for now
      expect(result1.files.length).toBe(result2.files.length);
    });
  });

  describe('getFile', () => {
    it('should return file details by ID', async () => {
      const result = await getFile({ id: 'test-file-1' });

      expect(result).toMatchObject({
        id: 'test-file-1',
        name: 'App.tsx',
        path: '/src/App.tsx',
        type: 'file',
        content: expect.stringContaining('React'),
        size: 95,
        lastModified: expect.any(Date)
      });
    });

    it('should include valid React component content', async () => {
      const result = await getFile({ id: 'test-file-1' });

      expect(result.content).toContain('import React');
      expect(result.content).toContain('function App()');
      expect(result.content).toContain('export default App');
    });

    it('should handle different file IDs', async () => {
      const result1 = await getFile({ id: 'file-1' });
      const result2 = await getFile({ id: 'file-2' });

      expect(result1.id).toBe('file-1');
      expect(result2.id).toBe('file-2');
    });

    it('should always return file type', async () => {
      const result = await getFile({ id: 'any-id' });

      expect(result.type).toBe('file');
    });
  });

  describe('createFile', () => {
    it('should create file with basic properties', async () => {
      const request: CreateFileRequest = {
        path: '/src/components/Button.tsx',
        type: 'file',
        content: 'export const Button = () => <button>Click me</button>;'
      };

      const result = await createFile(request);

      expect(result).toMatchObject({
        id: expect.any(String),
        name: 'Button.tsx',
        path: '/src/components/Button.tsx',
        type: 'file',
        content: 'export const Button = () => <button>Click me</button>;',
        size: request.content.length,
        lastModified: expect.any(Date)
      });
    });

    it('should extract filename from path correctly', async () => {
      const testCases = [
        { path: '/src/App.tsx', expectedName: 'App.tsx' },
        { path: '/components/ui/Button/index.ts', expectedName: 'index.ts' },
        { path: '/utils/helpers.js', expectedName: 'helpers.js' },
        { path: 'README.md', expectedName: 'README.md' }
      ];

      for (const testCase of testCases) {
        const request: CreateFileRequest = {
          path: testCase.path,
          type: 'file',
          content: ''
        };

        const result = await createFile(request);
        expect(result.name).toBe(testCase.expectedName);
      }
    });

    it('should handle file creation without content', async () => {
      const request: CreateFileRequest = {
        path: '/src/empty.ts',
        type: 'file'
      };

      const result = await createFile(request);

      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });

    it('should generate unique IDs for created files', async () => {
      const request: CreateFileRequest = {
        path: '/src/test.ts',
        type: 'file',
        content: 'test content'
      };

      const result1 = await createFile(request);
      
      // Wait a millisecond to ensure different timestamp-based IDs
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result2 = await createFile(request);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle directory creation', async () => {
      const request: CreateFileRequest = {
        path: '/src/components',
        type: 'directory'
      };

      const result = await createFile(request);

      expect(result.type).toBe('directory');
      expect(result.name).toBe('components');
      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });

    it('should handle edge case path with no filename', async () => {
      const request: CreateFileRequest = {
        path: '/src/',
        type: 'directory'
      };

      const result = await createFile(request);

      expect(result.name).toBe('untitled');
    });

    it('should set lastModified to current time', async () => {
      const beforeTime = new Date();
      
      const request: CreateFileRequest = {
        path: '/src/test.ts',
        type: 'file',
        content: 'test'
      };

      const result = await createFile(request);
      
      const afterTime = new Date();

      expect(result.lastModified.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.lastModified.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('updateFile', () => {
    it('should update file content', async () => {
      const updateRequest: UpdateFileRequest & { id: string } = {
        id: 'file-1',
        content: 'Updated content for the file'
      };

      const result = await updateFile(updateRequest);

      expect(result).toMatchObject({
        id: 'file-1',
        name: 'App.tsx',
        path: '/src/App.tsx',
        type: 'file',
        content: 'Updated content for the file',
        size: updateRequest.content.length,
        lastModified: expect.any(Date)
      });
    });

    it('should update file size based on content length', async () => {
      const shortContent = 'short';
      const longContent = 'a'.repeat(1000);

      const shortUpdate = await updateFile({
        id: 'file-1',
        content: shortContent
      });

      const longUpdate = await updateFile({
        id: 'file-2',
        content: longContent
      });

      expect(shortUpdate.size).toBe(shortContent.length);
      expect(longUpdate.size).toBe(longContent.length);
    });

    it('should update lastModified timestamp', async () => {
      const beforeTime = new Date();
      
      const updateRequest: UpdateFileRequest & { id: string } = {
        id: 'file-1',
        content: 'New content'
      };

      const result = await updateFile(updateRequest);
      
      const afterTime = new Date();

      expect(result.lastModified.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.lastModified.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should preserve file ID and metadata', async () => {
      const updateRequest: UpdateFileRequest & { id: string } = {
        id: 'specific-id-123',
        content: 'Updated content'
      };

      const result = await updateFile(updateRequest);

      expect(result.id).toBe('specific-id-123');
      expect(result.name).toBe('App.tsx'); // Mock always returns this
      expect(result.path).toBe('/src/App.tsx'); // Mock always returns this
      expect(result.type).toBe('file');
    });

    it('should handle empty content updates', async () => {
      const updateRequest: UpdateFileRequest & { id: string } = {
        id: 'file-1',
        content: ''
      };

      const result = await updateFile(updateRequest);

      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const result = await deleteFile({ id: 'file-to-delete' });

      expect(result).toEqual({
        success: true
      });
    });

    it('should handle deletion of any file ID', async () => {
      const testIds = ['file-1', 'file-2', 'non-existent-id', ''];

      for (const id of testIds) {
        const result = await deleteFile({ id });
        expect(result.success).toBe(true);
      }
    });

    it('should return success boolean property', async () => {
      const result = await deleteFile({ id: 'any-id' });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('File Type Validation', () => {
    it('should handle various file types in createFile', async () => {
      const fileTypes = [
        { path: '/src/component.tsx', type: 'file' as const },
        { path: '/src/styles.css', type: 'file' as const },
        { path: '/src/utils', type: 'directory' as const },
        { path: '/assets/image.png', type: 'file' as const }
      ];

      for (const fileType of fileTypes) {
        const request: CreateFileRequest = {
          path: fileType.path,
          type: fileType.type,
          content: fileType.type === 'file' ? 'content' : undefined
        };

        const result = await createFile(request);
        expect(result.type).toBe(fileType.type);
      }
    });
  });

  describe('Path Handling', () => {
    it('should handle various path formats', async () => {
      const paths = [
        '/absolute/path/file.ts',
        'relative/path/file.ts',
        './current/dir/file.ts',
        '../parent/dir/file.ts',
        '/file.ts',
        'file.ts'
      ];

      for (const path of paths) {
        const request: CreateFileRequest = {
          path,
          type: 'file',
          content: 'test'
        };

        const result = await createFile(request);
        expect(result.path).toBe(path);
      }
    });
  });
});