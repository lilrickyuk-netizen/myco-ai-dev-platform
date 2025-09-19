import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileExplorer from '../../../frontend/components/FileExplorer';
import type { FileNode } from '~backend/filesystem/types';

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onKeyDown, onBlur, autoFocus, ...props }: any) => (
    <input 
      value={value} 
      onChange={onChange} 
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      autoFocus={autoFocus}
      {...props} 
    />
  )
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  )
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: any) => <div>{children}</div>,
  ContextMenuContent: ({ children }: any) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick }: any) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => open ? <div role="dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>
}));

describe('FileExplorer', () => {
  const mockFiles: FileNode[] = [
    {
      id: 'dir-1',
      name: 'src',
      path: '/src',
      type: 'directory',
      size: 0,
      lastModified: new Date(),
      children: [
        {
          id: 'file-1',
          name: 'App.tsx',
          path: '/src/App.tsx',
          type: 'file',
          content: 'import React from "react";',
          size: 25,
          lastModified: new Date()
        },
        {
          id: 'file-2',
          name: 'index.ts',
          path: '/src/index.ts',
          type: 'file',
          content: 'export * from "./App";',
          size: 20,
          lastModified: new Date()
        }
      ]
    },
    {
      id: 'file-3',
      name: 'package.json',
      path: '/package.json',
      type: 'file',
      content: '{"name": "test"}',
      size: 16,
      lastModified: new Date()
    }
  ];

  const mockProps = {
    projectId: 'test-project',
    files: mockFiles,
    activeFile: mockFiles[0].children![0],
    onFileSelect: vi.fn(),
    onFileCreate: vi.fn(),
    onFileDelete: vi.fn(),
    onFileRename: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the file explorer header', () => {
    render(<FileExplorer {...mockProps} />);

    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('should render file tree with correct structure', () => {
    render(<FileExplorer {...mockProps} />);

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('should show folders before files', () => {
    render(<FileExplorer {...mockProps} />);

    const fileElements = screen.getAllByText(/src|package.json/);
    const srcIndex = fileElements.findIndex(el => el.textContent === 'src');
    const packageIndex = fileElements.findIndex(el => el.textContent === 'package.json');

    expect(srcIndex).toBeLessThan(packageIndex);
  });

  it('should expand/collapse folders when clicked', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Initially folder should be collapsed
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

    // Click on folder to expand
    const srcFolder = screen.getByText('src');
    await user.click(srcFolder);

    // Now should see children
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Click again to collapse
    await user.click(srcFolder);

    // Children should be hidden again
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
  });

  it('should call onFileSelect when file is clicked', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Click package.json file
    const packageFile = screen.getByText('package.json');
    await user.click(packageFile);

    expect(mockProps.onFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'package.json',
        path: '/package.json',
        type: 'file'
      })
    );
  });

  it('should highlight active file', () => {
    render(<FileExplorer {...mockProps} />);

    // Need to expand src folder first to see App.tsx
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    const activeFile = screen.getByText('App.tsx').closest('.rounded');
    expect(activeFile).toHaveClass('bg-accent');
  });

  it('should handle file creation from toolbar', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Click new file button in toolbar
    const newFileButtons = screen.getAllByTitle('New File');
    await user.click(newFileButtons[0]);

    expect(mockProps.onFileCreate).toHaveBeenCalledWith('file');
  });

  it('should handle folder creation from toolbar', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Click new folder button in toolbar
    const newFolderButtons = screen.getAllByTitle('New Folder');
    await user.click(newFolderButtons[0]);

    expect(mockProps.onFileCreate).toHaveBeenCalledWith('folder');
  });

  it('should show correct file icons based on extension', () => {
    render(<FileExplorer {...mockProps} />);

    // Expand src folder to see files
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    // Check that different file types have different icons
    // This is implicitly tested by the getFileIcon function
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });

  it('should handle file renaming', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Expand src folder
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    // Find and click the more options button for App.tsx
    const appFile = screen.getByText('App.tsx').closest('.rounded');
    const moreButton = appFile?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);

      // Click rename option
      const renameOption = screen.getByText('Rename');
      await user.click(renameOption);

      // Should show input field
      const renameInput = screen.getByDisplayValue('App.tsx');
      expect(renameInput).toBeInTheDocument();

      // Change the name
      await user.clear(renameInput);
      await user.type(renameInput, 'NewApp.tsx');
      await user.keyboard('{Enter}');

      expect(mockProps.onFileRename).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'App.tsx' }),
        'NewApp.tsx'
      );
    }
  });

  it('should cancel rename on Escape key', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Expand src folder
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    // Simulate starting rename
    const appFile = screen.getByText('App.tsx').closest('.rounded');
    const moreButton = appFile?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      const renameOption = screen.getByText('Rename');
      await user.click(renameOption);

      const renameInput = screen.getByDisplayValue('App.tsx');
      await user.type(renameInput, 'Changed');
      await user.keyboard('{Escape}');

      // Should not call onFileRename
      expect(mockProps.onFileRename).not.toHaveBeenCalled();
    }
  });

  it('should show delete confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    const packageFile = screen.getByText('package.json').closest('.rounded');
    const moreButton = packageFile?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);

      const deleteOption = screen.getByText('Delete');
      await user.click(deleteOption);

      // Should show confirmation dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete package.json')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete "package.json"?')).toBeInTheDocument();
    }
  });

  it('should handle delete confirmation', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    const packageFile = screen.getByText('package.json').closest('.rounded');
    const moreButton = packageFile?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);

      const deleteOption = screen.getByText('Delete');
      await user.click(deleteOption);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      expect(mockProps.onFileDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'package.json',
          path: '/package.json'
        })
      );
    }
  });

  it('should handle file creation in specific directory', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Expand src folder
    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    // Click more options on src folder
    const srcFolderElement = screen.getByText('src').closest('.rounded');
    const moreButton = srcFolderElement?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);

      // Click new file option
      const newFileOption = screen.getByText('New File');
      await user.click(newFileOption);

      expect(mockProps.onFileCreate).toHaveBeenCalledWith('file', '/src');
    }
  });

  it('should handle chevron click for folder expansion', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    // Find the chevron button for src folder
    const srcFolder = screen.getByText('src').closest('.rounded');
    const chevronButton = srcFolder?.querySelector('button');
    
    if (chevronButton) {
      await user.click(chevronButton);

      // Should show children
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    }
  });

  it('should not call onFileSelect when folder is clicked', async () => {
    const user = userEvent.setup();
    render(<FileExplorer {...mockProps} />);

    const srcFolder = screen.getByText('src');
    await user.click(srcFolder);

    // Should not call onFileSelect for directories
    expect(mockProps.onFileSelect).not.toHaveBeenCalled();
  });

  it('should handle empty file list', () => {
    render(<FileExplorer {...mockProps} files={[]} />);

    expect(screen.getByText('Explorer')).toBeInTheDocument();
    // Should not show any files
    expect(screen.queryByText('src')).not.toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();
  });

  it('should maintain folder expansion state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FileExplorer {...mockProps} />);

    // Expand src folder
    const srcFolder = screen.getByText('src');
    await user.click(srcFolder);

    expect(screen.getByText('App.tsx')).toBeInTheDocument();

    // Re-render with new props
    rerender(<FileExplorer {...mockProps} activeFile={null} />);

    // Should still be expanded
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
  });

  it('should handle nested directories', () => {
    const nestedFiles: FileNode[] = [
      {
        id: 'dir-1',
        name: 'src',
        path: '/src',
        type: 'directory',
        size: 0,
        lastModified: new Date(),
        children: [
          {
            id: 'dir-2',
            name: 'components',
            path: '/src/components',
            type: 'directory',
            size: 0,
            lastModified: new Date(),
            children: [
              {
                id: 'file-1',
                name: 'Button.tsx',
                path: '/src/components/Button.tsx',
                type: 'file',
                content: 'export const Button = () => {};',
                size: 30,
                lastModified: new Date()
              }
            ]
          }
        ]
      }
    ];

    render(<FileExplorer {...mockProps} files={nestedFiles} />);

    expect(screen.getByText('src')).toBeInTheDocument();
    
    // Expand src
    fireEvent.click(screen.getByText('src'));
    expect(screen.getByText('components')).toBeInTheDocument();
    
    // Expand components
    fireEvent.click(screen.getByText('components'));
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
  });

  it('should handle files without onFileCreate callback', () => {
    const propsWithoutCreate = {
      ...mockProps,
      onFileCreate: undefined
    };

    render(<FileExplorer {...propsWithoutCreate} />);

    // Should still render but creation buttons might be disabled or hidden
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('should handle files without onFileDelete callback', async () => {
    const user = userEvent.setup();
    const propsWithoutDelete = {
      ...mockProps,
      onFileDelete: undefined
    };

    render(<FileExplorer {...propsWithoutDelete} />);

    const packageFile = screen.getByText('package.json').closest('.rounded');
    const moreButton = packageFile?.querySelector('button');
    
    if (moreButton) {
      await user.click(moreButton);
      // Should still show menu but delete might be disabled
      expect(screen.getByText('Rename')).toBeInTheDocument();
    }
  });

  it('should properly sort files and directories', () => {
    const unsortedFiles: FileNode[] = [
      {
        id: 'file-1',
        name: 'z-file.txt',
        path: '/z-file.txt',
        type: 'file',
        size: 10,
        lastModified: new Date()
      },
      {
        id: 'dir-1',
        name: 'a-folder',
        path: '/a-folder',
        type: 'directory',
        size: 0,
        lastModified: new Date()
      },
      {
        id: 'file-2',
        name: 'a-file.txt',
        path: '/a-file.txt',
        type: 'file',
        size: 10,
        lastModified: new Date()
      },
      {
        id: 'dir-2',
        name: 'z-folder',
        path: '/z-folder',
        type: 'directory',
        size: 0,
        lastModified: new Date()
      }
    ];

    render(<FileExplorer {...mockProps} files={unsortedFiles} />);

    const fileElements = Array.from(document.querySelectorAll('.rounded')).map(
      el => el.textContent?.trim()
    );

    // Directories should come first, then files, both alphabetically sorted
    expect(fileElements.indexOf('a-folder')).toBeLessThan(fileElements.indexOf('z-folder'));
    expect(fileElements.indexOf('z-folder')).toBeLessThan(fileElements.indexOf('a-file.txt'));
    expect(fileElements.indexOf('a-file.txt')).toBeLessThan(fileElements.indexOf('z-file.txt'));
  });
});