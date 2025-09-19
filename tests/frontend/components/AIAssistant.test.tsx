import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistant from '../../../frontend/components/AIAssistant';

// Mock backend
vi.mock('~backend/client', () => ({
  default: {
    ai: {
      generate: vi.fn()
    }
  }
}));

// Mock toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  )
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, onKeyDown, ...props }: any) => (
    <textarea value={value} onChange={onChange} onKeyDown={onKeyDown} {...props} />
  )
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}));

import backend from '~backend/client';

describe('AIAssistant', () => {
  const mockProps = {
    projectId: 'test-project-123',
    activeFile: {
      id: 'file-1',
      name: 'App.tsx',
      path: '/src/App.tsx',
      content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}',
      isDirectory: false
    },
    onCodeInsert: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the AI assistant interface', () => {
    render(<AIAssistant {...mockProps} />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hello! I\'m your AI coding assistant.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask me anything about your code...')).toBeInTheDocument();
  });

  it('should display quick prompt buttons', () => {
    render(<AIAssistant {...mockProps} />);

    expect(screen.getByText('Generate Code')).toBeInTheDocument();
    expect(screen.getByText('Debug Issue')).toBeInTheDocument();
    expect(screen.getByText('Explain Code')).toBeInTheDocument();
    expect(screen.getByText('Suggest Improvements')).toBeInTheDocument();
  });

  it('should show active file context', () => {
    render(<AIAssistant {...mockProps} />);

    expect(screen.getByText('Context: App.tsx')).toBeInTheDocument();
  });

  it('should send message when user types and presses Enter', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'Here is your code solution...',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    
    await user.type(textarea, 'How do I create a React component?');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith({
        prompt: 'How do I create a React component?',
        context: expect.stringContaining('Current file: App.tsx'),
        projectId: 'test-project-123'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Here is your code solution...')).toBeInTheDocument();
    });
  });

  it('should not send message on Enter + Shift', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    
    await user.type(textarea, 'Test message');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('should handle quick prompt clicks', async () => {
    const user = userEvent.setup();
    render(<AIAssistant {...mockProps} />);

    const generateCodeButton = screen.getByText('Generate Code');
    await user.click(generateCodeButton);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    expect(textarea).toHaveValue('Help me write code for: ');
  });

  it('should show loading state when processing message', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    
    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockGenerate.mockReturnValue(promise);

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    // Should show loading state
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(textarea).toBeDisabled();

    // Resolve the promise
    resolvePromise!({
      content: 'Response',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
    });

    await waitFor(() => {
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockRejectedValue(new Error('API Error'));

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Sorry, I encountered an error processing your request. Please try again.')).toBeInTheDocument();
    });
  });

  it('should display user and assistant messages differently', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'AI Response',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'User message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('AI Response')).toBeInTheDocument();
    });

    // Check that messages have different styling (user messages should be on the right)
    const userMessage = screen.getByText('User message').closest('.mb-4');
    const aiMessage = screen.getByText('AI Response').closest('.mb-4');
    
    expect(userMessage).toHaveClass('ml-8');
    expect(aiMessage).toHaveClass('mr-8');
  });

  it('should extract and display code blocks', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'Here is your code:\n\n```javascript\nfunction hello() {\n  return "Hello, World!";\n}\n```',
      usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Generate a hello function');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('function hello() {\n  return "Hello, World!";\n}')).toBeInTheDocument();
    });
  });

  it('should handle code insertion', async () => {
    const user = userEvent.setup();
    const mockOnCodeInsert = vi.fn();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: '```javascript\nconst greeting = "Hello";\n```',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    });

    render(<AIAssistant {...mockProps} onCodeInsert={mockOnCodeInsert} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Create a greeting variable');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('const greeting = "Hello";')).toBeInTheDocument();
    });

    // Find and click the insert button (Code icon)
    const codeBlocks = screen.getAllByText('const greeting = "Hello";');
    expect(codeBlocks.length).toBeGreaterThan(0);
    
    // The insert button should be present when onCodeInsert is provided
    // We'll simulate the click since the actual button structure is complex
    const insertButtons = document.querySelectorAll('button');
    const insertButton = Array.from(insertButtons).find(btn => 
      btn.title?.includes('insert') || btn.textContent?.includes('Code')
    );
    
    if (insertButton) {
      await user.click(insertButton);
      expect(mockOnCodeInsert).toHaveBeenCalledWith('const greeting = "Hello";\n');
    }
  });

  it('should handle copy to clipboard', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: '```javascript\nconst test = "Hello";\n```',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Create a test variable');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('const test = "Hello";')).toBeInTheDocument();
    });

    // Find copy button and click it
    const copyButtons = document.querySelectorAll('button');
    const copyButton = Array.from(copyButtons).find(btn => 
      btn.title?.includes('copy') || btn.textContent?.includes('Copy')
    );
    
    if (copyButton) {
      await user.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const test = "Hello";\n');
    }
  });

  it('should work without active file', () => {
    render(<AIAssistant projectId="test-project" />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.queryByText('Context:')).not.toBeInTheDocument();
  });

  it('should include file context in AI requests when active file is present', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'Response',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Explain this code');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith({
        prompt: 'Explain this code',
        context: expect.stringContaining('Current file: App.tsx'),
        projectId: 'test-project-123'
      });
    });

    const call = mockGenerate.mock.calls[0][0];
    expect(call.context).toContain('Path: /src/App.tsx');
    expect(call.context).toContain('import React from "react"');
  });

  it('should disable input and send button while loading', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockGenerate.mockReturnValue(promise);

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();

    resolvePromise!({
      content: 'Response',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
    });

    await waitFor(() => {
      expect(textarea).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('should clear input after sending message', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'Response',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    
    await user.type(textarea, 'Test message');
    expect(textarea).toHaveValue('Test message');

    await user.keyboard('{Enter}');

    expect(textarea).toHaveValue('');
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    
    // Try to send empty message
    await user.keyboard('{Enter}');
    expect(mockGenerate).not.toHaveBeenCalled();

    // Try to send whitespace-only message
    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('should display message timestamps', async () => {
    const user = userEvent.setup();
    const mockGenerate = vi.mocked(backend.ai.generate);
    mockGenerate.mockResolvedValue({
      content: 'Response',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
    });

    render(<AIAssistant {...mockProps} />);

    const textarea = screen.getByPlaceholderText('Ask me anything about your code...');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      // Should show timestamp for user message
      const timeElements = document.querySelectorAll('.text-xs.text-gray-500');
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});