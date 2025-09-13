import React, { useEffect, useRef, useState } from 'react';
import { Save, Download, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { editorConfig } from '../config';

interface File {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirectory: boolean;
}

interface CodeEditorProps {
  file: File;
  onChange: (content: string) => void;
  onSave: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ file, onChange, onSave }) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(file.content || '');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setContent(file.content || '');
    setHasChanges(false);
  }, [file.id, file.content]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== (file.content || ''));
    onChange(newContent);
  };

  const handleSave = () => {
    onSave();
    setHasChanges(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
  };

  const getLanguage = () => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js': return 'JavaScript';
      case 'ts': return 'TypeScript';
      case 'jsx': return 'React (JSX)';
      case 'tsx': return 'React (TSX)';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'cpp': case 'c': return 'C/C++';
      case 'go': return 'Go';
      case 'rs': return 'Rust';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'scss': case 'sass': return 'SCSS';
      case 'json': return 'JSON';
      case 'md': return 'Markdown';
      case 'xml': return 'XML';
      case 'yaml': case 'yml': return 'YAML';
      default: return 'Text';
    }
  };

  const getFileSize = () => {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLineCount = () => {
    return content.split('\n').length;
  };

  const getCursorPosition = () => {
    if (!editorRef.current) return { line: 1, column: 1 };
    
    const textArea = editorRef.current;
    const cursorPos = textArea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  };

  const [cursorPos, setCursorPos] = useState(getCursorPosition());

  const handleSelectionChange = () => {
    setCursorPos(getCursorPosition());
  };

  // This is a basic textarea implementation
  // In a production app, you would use Monaco Editor or CodeMirror
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Editor Header */}
      <div className="border-b bg-card/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{file.name}</span>
              {hasChanges && (
                <Badge variant="secondary" className="text-xs">
                  Modified
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {getLanguage()}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(content)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setContent(file.content || '');
                setHasChanges(false);
              }}
              disabled={!hasChanges}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Revert
            </Button>
            
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          className="w-full h-full p-4 bg-transparent border-0 outline-none resize-none font-mono text-sm leading-relaxed"
          style={{
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
            fontSize: '14px',
            lineHeight: '1.6',
            tabSize: 2,
          }}
          placeholder="Start typing..."
          spellCheck={false}
        />

        {/* Line numbers overlay (simplified) */}
        <div className="absolute left-0 top-0 w-12 h-full bg-muted/20 border-r pointer-events-none">
          <div className="p-4 font-mono text-xs text-muted-foreground leading-relaxed">
            {Array.from({ length: getLineCount() }, (_, i) => (
              <div key={i + 1} className="text-right">
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Adjust textarea to account for line numbers */}
        <style>
          {`
            .CodeEditor textarea {
              padding-left: 64px !important;
            }
          `}
        </style>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card/50 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Line {cursorPos.line}, Column {cursorPos.column}</span>
            <span>{getLineCount()} lines</span>
            <span>{getFileSize()}</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span>UTF-8</span>
            <span>{getLanguage()}</span>
            {hasChanges && <span className="text-orange-500">●</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;import { useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { FileText, Save } from "lucide-react";
import type { FileNode } from "~backend/filesystem/types";

interface CodeEditorProps {
  file: FileNode | null;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function CodeEditor({ file, content, onChange, onSave }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      dart: 'dart',
      r: 'r',
      scala: 'scala',
      clj: 'clojure',
      hs: 'haskell',
      elm: 'elm',
      ex: 'elixir',
      erl: 'erlang',
      lua: 'lua',
      pl: 'perl',
      ps1: 'powershell',
      vb: 'vb',
      cs: 'csharp',
      fs: 'fsharp'
    };

    return languageMap[ext || ''] || 'plaintext';
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // Set up keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "on",
      renderWhitespace: "boundary",
      renderControlCharacters: true,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on"
    });
  };

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center bg-card">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-card">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No file selected</h3>
          <p className="text-muted-foreground">
            Select a file from the explorer to start editing
          </p>
        </div>
      </div>
    );
  }

  if (file.type === "directory") {
    return (
      <div className="h-full flex items-center justify-center bg-card">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Directory selected</h3>
          <p className="text-muted-foreground">
            Select a file to view its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{file.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={getLanguage(file.name)}
          value={content}
          onChange={(value) => onChange(value || "")}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 20,
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
            fontLigatures: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: "on",
            renderWhitespace: "boundary",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            padding: { top: 16, bottom: 16 },
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true
            }
          }}
        />
      </div>
    </div>
  );
}
