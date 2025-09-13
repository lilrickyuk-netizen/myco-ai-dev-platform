import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard';
import { useBackend } from '../src/hooks/useBackend';

// Mock the useBackend hook
vi.mock('../src/hooks/useBackend');

// Mock the backend module
vi.mock('~backend/client', () => ({
  default: {
    projects: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    templates: {
      list: vi.fn(),
    },
  },
}));

const mockBackend = {
  projects: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  templates: {
    list: vi.fn(),
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useBackend).mockReturnValue(mockBackend);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with projects list', async () => {
    const mockProjects = [
      {
        id: '1',
        name: 'Test Project 1',
        description: 'A test project',
        template: 'react-typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
      },
      {
        id: '2',
        name: 'Test Project 2',
        description: 'Another test project',
        template: 'express-typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
      },
    ];

    mockBackend.projects.list.mockResolvedValue(mockProjects);

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Projects')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching projects', () => {
    mockBackend.projects.list.mockImplementation(() => new Promise(() => {}));

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state when projects fetch fails', async () => {
    mockBackend.projects.list.mockRejectedValue(new Error('Failed to fetch'));

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/error loading projects/i)).toBeInTheDocument();
    });
  });

  it('opens create project dialog when create button is clicked', async () => {
    const user = userEvent.setup();
    mockBackend.projects.list.mockResolvedValue([]);
    mockBackend.templates.list.mockResolvedValue([
      {
        id: 'react-typescript',
        name: 'React TypeScript',
        description: 'Modern React app with TypeScript',
        category: 'web',
      },
    ]);

    render(<Dashboard />, { wrapper: createWrapper() });

    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
  });

  it('creates a new project when form is submitted', async () => {
    const user = userEvent.setup();
    const newProject = {
      id: '3',
      name: 'New Project',
      description: 'A new test project',
      template: 'react-typescript',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user1',
    };

    mockBackend.projects.list.mockResolvedValue([]);
    mockBackend.projects.create.mockResolvedValue(newProject);
    mockBackend.templates.list.mockResolvedValue([
      {
        id: 'react-typescript',
        name: 'React TypeScript',
        description: 'Modern React app with TypeScript',
        category: 'web',
      },
    ]);

    render(<Dashboard />, { wrapper: createWrapper() });

    // Open create dialog
    const createButton = screen.getByRole('button', { name: /create project/i });
    await user.click(createButton);

    // Fill form
    await user.type(screen.getByLabelText(/project name/i), 'New Project');
    await user.type(screen.getByLabelText(/description/i), 'A new test project');
    
    // Select template
    const templateSelect = screen.getByRole('combobox', { name: /template/i });
    await user.click(templateSelect);
    await user.click(screen.getByText('React TypeScript'));

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockBackend.projects.create).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'A new test project',
        template: 'react-typescript',
      });
    });
  });

  it('navigates to project when project card is clicked', async () => {
    const user = userEvent.setup();
    const mockProjects = [
      {
        id: '1',
        name: 'Test Project',
        description: 'A test project',
        template: 'react-typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
      },
    ];

    mockBackend.projects.list.mockResolvedValue(mockProjects);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    const projectCard = screen.getByTestId('project-card-1');
    await user.click(projectCard);

    // Check if navigation occurred (this would need to be mocked in a real test)
    expect(window.location.pathname).toBe('/ide/1');
  });

  it('shows empty state when no projects exist', async () => {
    mockBackend.projects.list.mockResolvedValue([]);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
      expect(screen.getByText(/create your first project/i)).toBeInTheDocument();
    });
  });

  it('filters projects by search term', async () => {
    const user = userEvent.setup();
    const mockProjects = [
      {
        id: '1',
        name: 'React Project',
        description: 'A React project',
        template: 'react-typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
      },
      {
        id: '2',
        name: 'Vue Project',
        description: 'A Vue project',
        template: 'vue-typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
      },
    ];

    mockBackend.projects.list.mockResolvedValue(mockProjects);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('React Project')).toBeInTheDocument();
      expect(screen.getByText('Vue Project')).toBeInTheDocument();
    });

    // Search for "React"
    const searchInput = screen.getByPlaceholderText(/search projects/i);
    await user.type(searchInput, 'React');

    await waitFor(() => {
      expect(screen.getByText('React Project')).toBeInTheDocument();
      expect(screen.queryByText('Vue Project')).not.toBeInTheDocument();
    });
  });

  it('sorts projects by different criteria', async () => {
    const user = userEvent.setup();
    const mockProjects = [
      {
        id: '1',
        name: 'Alpha Project',
        description: 'First project',
        template: 'react-typescript',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        userId: 'user1',
      },
      {
        id: '2',
        name: 'Beta Project',
        description: 'Second project',
        template: 'vue-typescript',
        createdAt: '2023-02-01T00:00:00Z',
        updatedAt: '2023-02-01T00:00:00Z',
        userId: 'user1',
      },
    ];

    mockBackend.projects.list.mockResolvedValue(mockProjects);

    render(<Dashboard />, { wrapper: createWrapper() });

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    });

    // Change sort to alphabetical
    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.selectOptions(sortSelect, 'name');

    // Projects should be sorted alphabetically
    const projectElements = screen.getAllByTestId(/^project-card-/);
    expect(projectElements[0]).toHaveTextContent('Alpha Project');
    expect(projectElements[1]).toHaveTextContent('Beta Project');
  });
});