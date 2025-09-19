import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './Dashboard';

// Mock the backend client
vi.mock('~backend/client', () => ({
  default: {
    project: {
      listProjects: vi.fn(),
      createProject: vi.fn(),
      deleteProject: vi.fn()
    }
  }
}));

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn(() => ({
    user: { id: 'test-user', firstName: 'Test', lastName: 'User' },
    isLoaded: true
  }))
}));

// Mock components
vi.mock('./CreateProjectDialog', () => ({
  default: ({ open, onOpenChange, onProjectCreated }: any) => (
    <div data-testid="create-dialog">
      {open && (
        <div>
          <button onClick={() => onProjectCreated({ id: 'new-project', name: 'New Project' })}>
            Create
          </button>
          <button onClick={() => onOpenChange(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}));

vi.mock('./ProjectCard', () => ({
  default: ({ project, onDelete }: any) => (
    <div data-testid={`project-${project.id}`}>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <button onClick={() => onDelete(project.id)}>Delete</button>
    </div>
  )
}));

describe('Dashboard', () => {
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

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );
  };

  it('should render dashboard with user greeting', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects).mockResolvedValue({
      projects: []
    });

    renderDashboard();

    expect(screen.getByText(/Welcome back, Test/)).toBeInTheDocument();
    expect(screen.getByText(/Recent Projects/)).toBeInTheDocument();
  });

  it('should display projects when loaded', async () => {
    const mockProjects = [
      {
        id: 'project-1',
        name: 'React App',
        description: 'A React application',
        template: 'react-typescript',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 'project-2',
        name: 'Express API',
        description: 'An Express.js API',
        template: 'express-typescript',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02'
      }
    ];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects).mockResolvedValue({
      projects: mockProjects
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('project-project-1')).toBeInTheDocument();
      expect(screen.getByTestId('project-project-2')).toBeInTheDocument();
    });

    expect(screen.getByText('React App')).toBeInTheDocument();
    expect(screen.getByText('Express API')).toBeInTheDocument();
  });

  it('should show empty state when no projects', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects).mockResolvedValue({
      projects: []
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
      expect(screen.getByText(/Create your first project to get started/)).toBeInTheDocument();
    });
  });

  it('should open create project dialog', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects).mockResolvedValue({
      projects: []
    });

    renderDashboard();
    const user = userEvent.setup();

    const createButton = screen.getByText(/Create Project/);
    await user.click(createButton);

    expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
  });

  it('should handle project creation', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects)
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValueOnce({
        projects: [{
          id: 'new-project',
          name: 'New Project',
          description: 'A new project',
          template: 'react-typescript',
          createdAt: '2024-01-03',
          updatedAt: '2024-01-03'
        }]
      });

    renderDashboard();
    const user = userEvent.setup();

    // Open dialog
    const createButton = screen.getByText(/Create Project/);
    await user.click(createButton);

    // Create project
    const createDialogButton = screen.getByText('Create');
    await user.click(createDialogButton);

    await waitFor(() => {
      expect(screen.getByTestId('project-new-project')).toBeInTheDocument();
    });
  });

  it('should handle project deletion', async () => {
    const mockProjects = [{
      id: 'project-to-delete',
      name: 'Project to Delete',
      description: 'This will be deleted',
      template: 'react-typescript',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }];

    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects)
      .mockResolvedValueOnce({ projects: mockProjects })
      .mockResolvedValueOnce({ projects: [] });
    vi.mocked(mockBackend.default.project.deleteProject).mockResolvedValue({
      success: true,
      message: 'Project deleted'
    });

    renderDashboard();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('project-project-to-delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByTestId('project-project-to-delete')).not.toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockBackend = await import('~backend/client');
    vi.mocked(mockBackend.default.project.listProjects).mockRejectedValue(
      new Error('API Error')
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Error loading projects/)).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    const mockBackend = import('~backend/client');
    // Don't resolve the promise to simulate loading

    renderDashboard();

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });
});