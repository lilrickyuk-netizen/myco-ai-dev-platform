import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Save, Loader2 } from 'lucide-react';
import { useBackend } from '../hooks/useBackend';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import Terminal from '../components/Terminal';
import AIAssistant from '../components/AIAssistant';
import { useToast } from '@/components/ui/use-toast';

interface Project {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  templateName: string;
  status: string;
}

interface FileNode {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export default function IDEPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const backend = useBackend();

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Load project and files
  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      try {
        setLoading(true);
        // Mock data for now since backend types need to be implemented
        setProject({
          id: projectId,
          name: 'My Project',
          description: 'A sample project',
          templateType: 'web',
          templateName: 'React TypeScript',
          status: 'active'
        });
        
        // Mock file structure
        setFiles([
          {
            id: '1',
            name: 'src',
            path: '/src',
            isDirectory: true,
            children: [
              {
                id: '2',
                name: 'index.ts',
                path: '/src/index.ts',
                isDirectory: false,
                content: '// Welcome to your project\nconsole.log("Hello, World!");'
              }
            ]
          }
        ]);
      } catch (err) {
        console.error('Failed to load project:', err);
        toast({
          title: 'Error',
          description: 'Failed to load project. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, backend, toast]);

  const handleFileSelect = (file: FileNode) => {
    if (!file.isDirectory) {
      setCurrentFile(file);
      setFileContent(file.content || '');
      setUnsavedChanges(false);
    }
  };

  const handleSave = async () => {
    if (!currentFile || !unsavedChanges) return;

    try {
      setSaving(true);
      // Mock save operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Success',
        description: `${currentFile.name} saved successfully`,
      });
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (content: string) => {
    setFileContent(content);
    setUnsavedChanges(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="font-semibold">{project?.name}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!unsavedChanges || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Run
          </Button>
        </div>
      </div>

      {/* Main IDE Layout */}
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-3rem)]">
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <div className="h-full border-r border-border">
            <FileExplorer
              files={files}
              onFileSelect={handleFileSelect}
              selectedFile={currentFile}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Main Content Area */}
        <ResizablePanel defaultSize={60}>
          <ResizablePanelGroup direction="vertical">
            {/* Code Editor */}
            <ResizablePanel defaultSize={70} minSize={30}>
              <div className="h-full">
                <CodeEditor
                  file={currentFile}
                  content={fileContent}
                  onChange={handleContentChange}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Terminal */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="h-full border-t border-border">
                <Terminal projectId={projectId || ''} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* AI Assistant Panel */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <div className="h-full border-l border-border">
            <AIAssistant projectId={projectId || ''} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}