import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listFiles, readFile, writeFile, deleteFile, createDirectory } from './filesystem';
import type { WriteFileRequest, CreateDirectoryRequest } from './types';

vi.mock('~encore/auth', () => ({
  requireUser: vi.fn().mockReturnValue({ id: 'test-user' })
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((path) => `/workspace/${path}`),
  dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/'))
}));

describe('Filesystem Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      const projectId = 'test-project';
      const path = 'src';

      // Mock fs response
      vi.mocked(require('fs/promises').readdir).mockResolvedValueOnce([
        { name: 'App.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'components', isDirectory: () => true, isFile: () => false },
        { name: 'utils.ts', isDirectory: () => false, isFile: () => true }
      ]);

      const result = await listFiles(projectId, path);

      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files).toHaveLength(3);
      expect(result.files[0].name).toBe('App.tsx');
      expect(result.files[0].type).toBe('file');
      expect(result.files[1].name).toBe('components');
      expect(result.files[1].type).toBe('directory');
    });

    it('should handle empty directory', async () => {
      const projectId = 'test-project';
      const path = 'empty';

      vi.mocked(require('fs/promises').readdir).mockResolvedValueOnce([]);

      const result = await listFiles(projectId, path);

      expect(result.files).toHaveLength(0);
    });

    it('should handle non-existent directory', async () => {
      const projectId = 'test-project';
      const path = 'non-existent';

      vi.mocked(require('fs/promises').readdir).mockRejectedValueOnce(
        new Error('ENOENT: no such file or directory')
      );

      await expect(listFiles(projectId, path)).rejects.toThrow('Directory not found');
    });

    it('should validate project access', async () => {
      const projectId = 'other-user-project';
      const path = 'src';

      // Mock unauthorized access
      await expect(listFiles(projectId, path)).rejects.toThrow('Access denied');
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const projectId = 'test-project';
      const filePath = 'src/App.tsx';

      vi.mocked(require('fs/promises').readFile).mockResolvedValueOnce(
        'import React from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}\n\nexport default App;'
      );

      const result = await readFile(projectId, filePath);

      expect(result.content).toContain('import React');
      expect(result.content).toContain('function App');
      expect(result.path).toBe(filePath);
    });

    it('should handle binary files', async () => {
      const projectId = 'test-project';
      const filePath = 'src/logo.png';

      vi.mocked(require('fs/promises').readFile).mockResolvedValueOnce(
        Buffer.from('binary-data')
      );

      const result = await readFile(projectId, filePath);

      expect(result.content).toBe('[Binary file]');
    });

    it('should handle non-existent file', async () => {
      const projectId = 'test-project';
      const filePath = 'non-existent.txt';

      vi.mocked(require('fs/promises').readFile).mockRejectedValueOnce(
        new Error('ENOENT: no such file or directory')
      );

      await expect(readFile(projectId, filePath)).rejects.toThrow('File not found');
    });
  });

  describe('writeFile', () => {
    it('should write file successfully', async () => {
      const projectId = 'test-project';
      const request: WriteFileRequest = {
        content: 'import React from "react";\n\nfunction NewComponent() {\n  return <div>New</div>;\n}'
      };

      vi.mocked(require('fs/promises').writeFile).mockResolvedValueOnce(undefined);

      const result = await writeFile('test-file-id', request);

      expect(result.name).toBeDefined();
      expect(result.content).toBe(request.content);
    });

    it('should validate file path', async () => {
      const projectId = 'test-project';
      const request: WriteFileRequest = {
        content: 'malicious content'
      };

      await expect(writeFile('test-file-id', request)).rejects.toThrow('Invalid file path');
    });

    it('should create directories if needed', async () => {
      const projectId = 'test-project';
      const request: WriteFileRequest = {
        content: 'component content'
      };

      vi.mocked(require('fs/promises').mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(require('fs/promises').writeFile).mockResolvedValueOnce(undefined);

      const result = await writeFile('test-file-id', request);

      expect(result.content).toBe(request.content);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const projectId = 'test-project';
      const filePath = 'src/OldComponent.tsx';

      vi.mocked(require('fs/promises').unlink).mockResolvedValueOnce(undefined);

      const result = await deleteFile({ id: filePath });

      expect(result.success).toBe(true);
    });

    it('should handle non-existent file deletion', async () => {
      const projectId = 'test-project';
      const filePath = 'non-existent.txt';

      vi.mocked(require('fs/promises').unlink).mockRejectedValueOnce(
        new Error('ENOENT: no such file or directory')
      );

      await expect(deleteFile({ id: filePath })).rejects.toThrow('File not found');
    });

    it('should validate file path for deletion', async () => {
      const projectId = 'test-project';
      const filePath = '../../../important-file.txt';

      await expect(deleteFile({ id: filePath })).rejects.toThrow('Invalid file path');
    });
  });

  describe('createDirectory', () => {
    it('should create directory successfully', async () => {
      const projectId = 'test-project';
      const request: CreateDirectoryRequest = {
        projectId: projectId,
        path: 'src/components/ui'
      };

      vi.mocked(require('fs/promises').mkdir).mockResolvedValueOnce(undefined);

      const result = await createDirectory(projectId, request);

      expect(result.type).toBe('directory');
      expect(result.path).toBe(request.path);
    });

    it('should handle existing directory', async () => {
      const projectId = 'test-project';
      const request: CreateDirectoryRequest = {
        projectId: projectId,
        path: 'src/components'
      };

      vi.mocked(require('fs/promises').mkdir).mockRejectedValueOnce(
        new Error('EEXIST: file already exists')
      );

      await expect(createDirectory(projectId, request)).rejects.toThrow('Directory already exists');
    });

    it('should validate directory path', async () => {
      const projectId = 'test-project';
      const request: CreateDirectoryRequest = {
        projectId: projectId,
        path: '../../../malicious'
      };

      await expect(createDirectory(projectId, request)).rejects.toThrow('Invalid directory path');
    });
  });
});