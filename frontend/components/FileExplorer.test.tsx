import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FileExplorer from './FileExplorer';

// Mock the backend client
vi.mock('~backend/client', () => ({
  default: {
    filesystem: {
      listFiles: vi.fn(),
      readFile: vi.fn(),
      createDirectory: vi.fn(),
      deleteFile: vi.fn()
    }
  }
}));

// Mock icons
vi.mock('lucide-react', () => ({
  Folder: () => <div data-testid="folder-icon" />,
  File: () => <div data-testid="file-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Trash: () => <div data-testid="trash-icon" />,
  ChevronRight: () => <div data-testid="chevron-right" />,
  ChevronDown: () => <div data-testid="chevron-down" />
}));

describe('FileExplorer', () => {
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

  const renderFileExplorer = (props = {}) => {
    const defaultProps = {
      projectId: 'test-project',
      onFileSelect: vi.fn(),
      selectedFile: null,
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <FileExplorer {...defaultProps} />
      </QueryClientProvider>
    );
  };

  it('should render file explorer with root files', async () => {
    const mockFiles = [
      { name: 'src', type: 'directory', path: 'src' },
      { name: 'package.json', type: 'file', path: 'package.json' },
      { name: 'README.md', type: 'file', path: 'README.md' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });

    renderFileExplorer();

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('folder-icon')).toHaveLength(1);
    expect(screen.getAllByTestId('file-icon')).toHaveLength(2);
  });

  it('should expand and collapse directories', async () => {
    const mockRootFiles = [
      { name: 'src', type: 'directory', path: 'src' }
    ];

    const mockSrcFiles = [
      { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
      { name: 'components', type: 'directory', path: 'src/components' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles)
      .mockResolvedValueOnce({ files: mockRootFiles })
      .mockResolvedValueOnce({ files: mockSrcFiles });

    renderFileExplorer();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Click to expand directory
    const srcFolder = screen.getByText('src');
    await user.click(srcFolder);

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
    });

    // Click again to collapse
    await user.click(srcFolder);

    await waitFor(() => {
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
    });
  });

  it('should handle file selection', async () => {
    const mockOnFileSelect = vi.fn();
    const mockFiles = [
      { name: 'App.tsx', type: 'file', path: 'src/App.tsx' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });

    renderFileExplorer({ onFileSelect: mockOnFileSelect });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    const fileItem = screen.getByText('App.tsx');
    await user.click(fileItem);

    expect(mockOnFileSelect).toHaveBeenCalledWith('src/App.tsx');
  });

  it('should highlight selected file', async () => {
    const mockFiles = [
      { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
      { name: 'index.tsx', type: 'file', path: 'src/index.tsx' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });

    renderFileExplorer({ selectedFile: 'src/App.tsx' });

    await waitFor(() => {
      const selectedFile = screen.getByText('App.tsx').closest('[data-selected="true"]');
      expect(selectedFile).toBeInTheDocument();
    });
  });

  it('should create new directory', async () => {
    const mockFiles = [
      { name: 'src', type: 'directory', path: 'src' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });
    vi.mocked(mockBackend.default.filesystem.createDirectory).mockResolvedValue({
      success: true,
      path: 'src/new-folder'
    });

    renderFileExplorer();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Right-click to open context menu
    const srcFolder = screen.getByText('src');
    await user.pointer({ keys: '[MouseRight]', target: srcFolder });

    // Click "New Folder" option
    const newFolderButton = screen.getByText(/New Folder/);
    await user.click(newFolderButton);

    // Enter folder name
    const input = screen.getByRole('textbox');
    await user.type(input, 'new-folder');
    await user.keyboard('[Enter]');

    expect(mockBackend.default.filesystem.createDirectory).toHaveBeenCalledWith(
      'test-project',
      { path: 'src/new-folder' }
    );
  });

  it('should delete files', async () => {
    const mockFiles = [
      { name: 'old-file.txt', type: 'file', path: 'old-file.txt' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });
    vi.mocked(mockBackend.default.filesystem.deleteFile).mockResolvedValue({
      success: true,
      message: 'File deleted'
    });

    renderFileExplorer();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('old-file.txt')).toBeInTheDocument();
    });

    // Right-click to open context menu
    const fileItem = screen.getByText('old-file.txt');
    await user.pointer({ keys: '[MouseRight]', target: fileItem });

    // Click "Delete" option
    const deleteButton = screen.getByText(/Delete/);
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText(/Confirm/);
    await user.click(confirmButton);

    expect(mockBackend.default.filesystem.deleteFile).toHaveBeenCalledWith(
      'test-project',
      'old-file.txt'
    );
  });

  it('should handle API errors gracefully', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockRejectedValue(
      new Error('API Error')
    );

    renderFileExplorer();

    await waitFor(() => {
      expect(screen.getByText(/Error loading files/)).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    const mockBackend = import('~backend/client');
    // Don't resolve the promise to simulate loading

    renderFileExplorer();

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('should filter files by search query', async () => {
    const mockFiles = [
      { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
      { name: 'index.tsx', type: 'file', path: 'src/index.tsx' },
      { name: 'styles.css', type: 'file', path: 'src/styles.css' }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.filesystem.listFiles).mockResolvedValue({
      files: mockFiles
    });

    renderFileExplorer();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.tsx')).toBeInTheDocument();
      expect(screen.getByText('styles.css')).toBeInTheDocument();
    });

    // Search for typescript files
    const searchInput = screen.getByPlaceholderText(/Search files/);
    await user.type(searchInput, '.tsx');

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.tsx')).toBeInTheDocument();
      expect(screen.queryByText('styles.css')).not.toBeInTheDocument();
    });
  });
});