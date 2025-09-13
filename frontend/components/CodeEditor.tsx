import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as monaco from 'monaco-editor';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';

interface CodeEditorProps {
  projectId: string;
  filePath: string;
  className?: string;
}

export default function CodeEditor({ projectId, filePath, className }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fileData, isLoading } = useQuery({
    queryKey: ['file', projectId, filePath],
    queryFn: async () => {
      try {
        return await backend.files.get({ projectId, path: filePath });
      } catch (error) {
        console.error('Failed to fetch file:', error);
        return null;
      }
    },
    enabled: !!filePath,
  });

  const saveFileMutation = useMutation({
    mutationFn: async (content: string) => {
      return await backend.files.save({
        projectId,
        path: filePath,
        content,
      });
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setOriginalContent(editor?.getValue() || '');
      queryClient.invalidateQueries({ queryKey: ['file', projectId, filePath] });
      toast({
        title: 'File saved',
        description: `${filePath} has been saved successfully.`,
      });
    },
    onError: (error) => {
      console.error('Failed to save file:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive',
      });
    },
  });

  // Initialize Monaco Editor
  useEffect(() => {
    if (!editorRef.current) return;

    const editorInstance = monaco.editor.create(editorRef.current, {
      value: '',
      language: getLanguageFromPath(filePath),
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      folding: true,
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
    });

    // Track changes
    editorInstance.onDidChangeModelContent(() => {
      const currentContent = editorInstance.getValue();
      setHasUnsavedChanges(currentContent !== originalContent);
    });

    // Keyboard shortcuts
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    setEditor(editorInstance);

    return () => {
      editorInstance.dispose();
    };
  }, [filePath]);

  // Update editor content when file data changes
  useEffect(() => {
    if (editor && fileData) {
      const content = fileData.content || '';
      editor.setValue(content);
      setOriginalContent(content);
      setHasUnsavedChanges(false);
      
      // Update language
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, getLanguageFromPath(filePath));
      }
    }
  }, [editor, fileData, filePath]);

  const handleSave = () => {
    if (!editor || !hasUnsavedChanges) return;
    const content = editor.getValue();
    saveFileMutation.mutate(content);
  };

  const handleRevert = () => {
    if (!editor || !hasUnsavedChanges) return;
    editor.setValue(originalContent);
    setHasUnsavedChanges(false);
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">📝</div>
          <p>Select a file to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Editor Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{filePath}</span>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevert}
            disabled={!hasUnsavedChanges}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Revert
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saveFileMutation.isPending}
            className="text-xs"
          >
            <Save className="w-3 h-3 mr-1" />
            {saveFileMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div ref={editorRef} className="flex-1" />
    </div>
  );
}