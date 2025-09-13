import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Menu, 
  Settings, 
  Play, 
  Square, 
  Save, 
  Users, 
  MessageSquare, 
  Sparkles,
  ChevronLeft,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import Terminal from '../components/Terminal';
import AIAssistant from '../components/AIAssistant';
import CollaborationPanel from '../components/CollaborationPanel';
import type { Project } from '~backend/projects/types';

export default function IDEPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      try {
        return await backend.projects.get({ id: projectId });
      } catch (error) {
        console.error('Failed to fetch project:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project',
          variant: 'destructive',
        });
        throw error;
      }
    },
    enabled: !!projectId,
  });

  const handleSave = async () => {
    if (!selectedFile || !projectId) return;
    
    try {
      toast({
        title: 'Saved',
        description: `${selectedFile} has been saved`,
      });
    } catch (error) {
      console.error('Failed to save file:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive',
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsTerminalOpen(!isTerminalOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, projectId, isTerminalOpen]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Project not found</h1>
          <Button onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          
          <div className="flex items-center space-x-2">
            <h1 className="font-semibold text-foreground">{project.name}</h1>
            <Badge variant="secondary" className="text-xs">
              {project.template}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollabOpen(!isCollabOpen)}
            className={isCollabOpen ? 'bg-accent' : ''}
          >
            <Users className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAIOpen(!isAIOpen)}
            className={isAIOpen ? 'bg-accent' : ''}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={!selectedFile}
          >
            <Save className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Play className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/settings`)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col">
          <FileExplorer
            projectId={projectId!}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <CodeEditor
              projectId={projectId!}
              filePath={selectedFile}
              className="flex-1"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="space-y-4">
                <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center mx-auto">
                  <Menu className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">No file selected</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a file from the explorer to start editing
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Terminal */}
          {isTerminalOpen && (
            <div 
              className="border-t bg-card"
              style={{ height: terminalHeight }}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-sm font-medium text-foreground">Terminal</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTerminalOpen(false)}
                >
                  <Square className="h-3 w-3" />
                </Button>
              </div>
              <Terminal projectId={projectId!} />
            </div>
          )}
        </div>

        {/* Side Panels */}
        {isAIOpen && (
          <div className="w-80 border-l bg-card">
            <AIAssistant
              projectId={projectId!}
              selectedFile={selectedFile}
              onClose={() => setIsAIOpen(false)}
            />
          </div>
        )}

        {isCollabOpen && (
          <div className="w-80 border-l bg-card">
            <CollaborationPanel
              projectId={projectId!}
              onClose={() => setIsCollabOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 text-xs bg-card border-t text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>Ready</span>
          {selectedFile && (
            <span>{selectedFile}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className="hover:text-foreground"
          >
            Terminal
          </button>
          <div className="flex items-center space-x-1">
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
            <span>Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
