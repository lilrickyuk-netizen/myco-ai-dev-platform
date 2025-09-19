import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '../../../frontend/components/CodeEditor';
import type { FileNode } from '~backend/filesystem/types';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ value, onChange, onMount, language, theme, options }: any) => {
    // Simulate Monaco editor mounting
    if (onMount) {
      const mockEditor = {
        addCommand: vi.fn(),
        updateOptions: vi.fn(),
        getValue: () => value,
        setValue: (newValue: string) => onChange(newValue)
      };
      
      // Mock monaco global
      (window as any).monaco = {
        KeyMod: { CtrlCmd: 1 },
        KeyCode: { KeyS: 2 }
      };
      
      setTimeout(() => onMount(mockEditor), 0);
    }

    return (
      <div data-testid="monaco-editor">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-language={language}
          data-theme={theme}
          style={{ width: '100%', height: '100%', minHeight: '400px' }}
        />
      </div>
    );
  }
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

describe('CodeEditor', () => {
  const mockFile: FileNode = {
    id: 'file-1',
    name: 'App.tsx',
    path: '/src/App.tsx',
    type: 'file',
    content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}',
    size: 65,
    lastModified: new Date()
  };

  const mockProps = {
    file: mockFile,
    content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}',
    onChange: vi.fn(),
    onSave: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<CodeEditor {...mockProps} />);
    
    expect(screen.getByText('Loading editor...')).toBeInTheDocument();
  });

  it('should render editor after mounting', async () => {
    render(<CodeEditor {...mockProps} />);
    
    // Wait for the component to mount
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should show "no file selected" when file is null', async () => {
    render(<CodeEditor {...mockProps} file={null} />);
    
    await vi.waitFor(() => {
      expect(screen.getByText('No file selected')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Select a file from the explorer to start editing')).toBeInTheDocument();
  });

  it('should show directory message for directory files', async () => {
    const directoryFile: FileNode = {
      id: 'dir-1',
      name: 'src',
      path: '/src',
      type: 'directory',
      size: 0,
      lastModified: new Date()
    };

    render(<CodeEditor {...mockProps} file={directoryFile} />);
    
    await vi.waitFor(() => {
      expect(screen.getByText('Directory selected')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Select a file to view its contents')).toBeInTheDocument();
  });

  it('should call onChange when editor content changes', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    render(<CodeEditor {...mockProps} onChange={mockOnChange} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'console.log("Hello");');

    expect(mockOnChange).toHaveBeenCalledWith('console.log("Hello");');
  });

  it('should call onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSave = vi.fn();

    render(<CodeEditor {...mockProps} onSave={mockOnSave} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
  });

  describe('Language Detection', () => {
    const testCases = [
      { filename: 'App.tsx', expectedLanguage: 'typescript' },
      { filename: 'component.jsx', expectedLanguage: 'javascript' },
      { filename: 'script.js', expectedLanguage: 'javascript' },
      { filename: 'styles.css', expectedLanguage: 'css' },
      { filename: 'data.json', expectedLanguage: 'json' },
      { filename: 'README.md', expectedLanguage: 'markdown' },
      { filename: 'main.py', expectedLanguage: 'python' },
      { filename: 'index.html', expectedLanguage: 'html' },
      { filename: 'config.yml', expectedLanguage: 'yaml' },
      { filename: 'script.sh', expectedLanguage: 'shell' },
      { filename: 'main.go', expectedLanguage: 'go' },
      { filename: 'app.rs', expectedLanguage: 'rust' },
      { filename: 'Main.java', expectedLanguage: 'java' },
      { filename: 'program.cpp', expectedLanguage: 'cpp' },
      { filename: 'program.c', expectedLanguage: 'c' },
      { filename: 'unknown.xyz', expectedLanguage: 'plaintext' }
    ];

    testCases.forEach(({ filename, expectedLanguage }) => {
      it(`should detect ${expectedLanguage} for ${filename}`, async () => {
        const file: FileNode = {
          ...mockFile,
          name: filename,
          path: `/src/${filename}`
        };

        render(<CodeEditor {...mockProps} file={file} />);
        
        await vi.waitFor(() => {
          expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
        });

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('data-language', expectedLanguage);
      });
    });
  });

  it('should use dark theme', async () => {
    render(<CodeEditor {...mockProps} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('data-theme', 'vs-dark');
  });

  it('should set up keyboard shortcuts on editor mount', async () => {
    const mockAddCommand = vi.fn();
    const mockUpdateOptions = vi.fn();

    // Mock the editor reference
    vi.mocked(require('@monaco-editor/react').Editor).mockImplementation(({ onMount }: any) => {
      if (onMount) {
        const mockEditor = {
          addCommand: mockAddCommand,
          updateOptions: mockUpdateOptions
        };
        
        (window as any).monaco = {
          KeyMod: { CtrlCmd: 1 },
          KeyCode: { KeyS: 2 }
        };
        
        setTimeout(() => onMount(mockEditor), 0);
      }

      return <div data-testid="monaco-editor" />;
    });

    render(<CodeEditor {...mockProps} />);
    
    await vi.waitFor(() => {
      expect(mockAddCommand).toHaveBeenCalled();
      expect(mockUpdateOptions).toHaveBeenCalled();
    });
  });

  it('should handle empty content gracefully', async () => {
    render(<CodeEditor {...mockProps} content="" />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('');
  });

  it('should handle undefined content changes', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();

    // Mock the Editor to simulate undefined value
    vi.mocked(require('@monaco-editor/react').Editor).mockImplementation(({ onChange }: any) => {
      return (
        <textarea
          data-testid="monaco-editor"
          onChange={() => onChange(undefined)}
        />
      );
    });

    render(<CodeEditor {...mockProps} onChange={mockOnChange} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor');
    fireEvent.change(textarea);

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('should display file name in header', async () => {
    render(<CodeEditor {...mockProps} />);
    
    await vi.waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });
  });

  it('should apply correct editor options', async () => {
    const mockUpdateOptions = vi.fn();

    vi.mocked(require('@monaco-editor/react').Editor).mockImplementation(({ onMount, options }: any) => {
      if (onMount) {
        const mockEditor = {
          addCommand: vi.fn(),
          updateOptions: mockUpdateOptions
        };
        setTimeout(() => onMount(mockEditor), 0);
      }

      // Verify options are passed correctly
      expect(options).toMatchObject({
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 20,
        fontFamily: expect.stringContaining('Fira Code'),
        fontLigatures: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on'
      });

      return <div data-testid="monaco-editor" />;
    });

    render(<CodeEditor {...mockProps} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('should handle large files efficiently', async () => {
    const largeContent = 'a'.repeat(100000); // 100KB content
    
    render(<CodeEditor {...mockProps} content={largeContent} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(largeContent);
  });

  it('should handle special characters in content', async () => {
    const specialContent = 'const emoji = "🚀";\nconst unicode = "café";\nconst symbols = "!@#$%^&*()";';
    
    render(<CodeEditor {...mockProps} content={specialContent} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(specialContent);
  });

  it('should maintain editor state when file changes', async () => {
    const { rerender } = render(<CodeEditor {...mockProps} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    // Change to a different file
    const newFile: FileNode = {
      ...mockFile,
      id: 'file-2',
      name: 'Component.tsx',
      path: '/src/Component.tsx'
    };

    rerender(<CodeEditor {...mockProps} file={newFile} />);

    expect(screen.getByText('Component.tsx')).toBeInTheDocument();
  });

  it('should handle file with no extension', async () => {
    const fileWithoutExt: FileNode = {
      ...mockFile,
      name: 'Dockerfile',
      path: '/Dockerfile'
    };

    render(<CodeEditor {...mockProps} file={fileWithoutExt} />);
    
    await vi.waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('data-language', 'plaintext');
  });
});