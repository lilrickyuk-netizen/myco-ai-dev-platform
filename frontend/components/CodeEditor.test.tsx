import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from './CodeEditor';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language, theme, options }: any) => (
    <div data-testid="monaco-editor">
      <textarea
        data-testid="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-language={language}
        data-theme={theme}
      />
      <div data-testid="editor-options">{JSON.stringify(options)}</div>
    </div>
  )
}));

describe('CodeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render editor with initial value', () => {
    const initialCode = 'console.log("Hello World");';
    
    render(
      <CodeEditor
        value={initialCode}
        language="javascript"
        onChange={() => {}}
      />
    );

    const textarea = screen.getByTestId('editor-textarea');
    expect(textarea).toHaveValue(initialCode);
    expect(textarea).toHaveAttribute('data-language', 'javascript');
  });

  it('should call onChange when code is modified', async () => {
    const mockOnChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CodeEditor
        value=""
        language="typescript"
        onChange={mockOnChange}
      />
    );

    const textarea = screen.getByTestId('editor-textarea');
    await user.type(textarea, 'const x = 1;');

    expect(mockOnChange).toHaveBeenCalledWith('const x = 1;');
  });

  it('should support different languages', () => {
    const { rerender } = render(
      <CodeEditor
        value="function test() {}"
        language="javascript"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveAttribute('data-language', 'javascript');

    rerender(
      <CodeEditor
        value="def test():"
        language="python"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveAttribute('data-language', 'python');
  });

  it('should support dark and light themes', () => {
    const { rerender } = render(
      <CodeEditor
        value=""
        language="typescript"
        theme="dark"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveAttribute('data-theme', 'dark');

    rerender(
      <CodeEditor
        value=""
        language="typescript"
        theme="light"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveAttribute('data-theme', 'light');
  });

  it('should pass editor options correctly', () => {
    const options = {
      fontSize: 14,
      minimap: { enabled: false },
      wordWrap: 'on' as const
    };

    render(
      <CodeEditor
        value=""
        language="typescript"
        onChange={() => {}}
        options={options}
      />
    );

    const optionsDiv = screen.getByTestId('editor-options');
    expect(optionsDiv).toHaveTextContent(JSON.stringify(options));
  });

  it('should handle readonly mode', () => {
    render(
      <CodeEditor
        value="readonly code"
        language="typescript"
        onChange={() => {}}
        readOnly={true}
      />
    );

    const optionsDiv = screen.getByTestId('editor-options');
    expect(optionsDiv.textContent).toContain('readOnly":true');
  });

  it('should handle file loading', async () => {
    const mockOnChange = vi.fn();

    render(
      <CodeEditor
        value=""
        language="typescript"
        onChange={mockOnChange}
        filePath="/path/to/file.ts"
      />
    );

    // Simulate file loading
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  it('should support syntax highlighting for various languages', () => {
    const languages = ['typescript', 'javascript', 'python', 'json', 'markdown'];

    languages.forEach(language => {
      const { rerender } = render(
        <CodeEditor
          value={`// Code in ${language}`}
          language={language}
          onChange={() => {}}
        />
      );

      expect(screen.getByTestId('editor-textarea')).toHaveAttribute('data-language', language);
    });
  });

  it('should handle large files efficiently', () => {
    const largeContent = 'line\n'.repeat(10000);

    render(
      <CodeEditor
        value={largeContent}
        language="typescript"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveValue(largeContent);
  });

  it('should update value when prop changes', () => {
    const { rerender } = render(
      <CodeEditor
        value="initial"
        language="typescript"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveValue('initial');

    rerender(
      <CodeEditor
        value="updated"
        language="typescript"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('editor-textarea')).toHaveValue('updated');
  });
});