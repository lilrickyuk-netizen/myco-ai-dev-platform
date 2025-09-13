import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Split, 
  Play, 
  Square, 
  Terminal as TerminalIcon, 
  Users, 
  Settings,
  Save,
  Undo,
  Redo,
  Search,
  Download,
  Upload,
  GitBranch,
  Deployment
} from 'lucide-react';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import Terminal from '../components/Terminal';
import AIAssistant from '../components/AIAssistant';
import CollaborationPanel from '../components/CollaborationPanel';

interface Project {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  templateName: string;
  status: string;
}

interface File {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirectory: boolean;
  children?: File[];
}

const IDEPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const backend = useBackend();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [openFiles, setOpenFiles] = useState<File[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadFiles();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      const projectData = await backend.projects.get({ id: projectId! });
      setProject(projectData);
    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileData = await backend.files.list({ projectId: projectId! });
      setFiles(fileData.files);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.isDirectory) return;
    
    // Check if file is already open
    const existingFile = openFiles.find(f => f.id === file.id);
    if (existingFile) {
      setActiveFile(existingFile);
      return;
    }

    try {
      // Load file content if not already loaded
      let fileWithContent = file;
      if (file.content === undefined) {
        fileWithContent = await backend.files.get({ id: file.id });
      }
      
      setOpenFiles(prev => [...prev, fileWithContent]);
      setActiveFile(fileWithContent);
    } catch (error) {
      console.error('Error loading file content:', error);
      toast({
        title: "Error",
        description: "Failed to load file content",
        variant: "destructive",
      });
    }
  };

  const handleFileClose = (fileId: string) => {
    setOpenFiles(prev => prev.filter(f => f.id !== fileId));
    setUnsavedChanges(prev => {
      const newChanges = new Set(prev);
      newChanges.delete(fileId);
      return newChanges;
    });
    
    // Set new active file
    const remainingFiles = openFiles.filter(f => f.id !== fileId);
    if (remainingFiles.length > 0) {
      setActiveFile(remainingFiles[remainingFiles.length - 1]);
    } else {
      setActiveFile(null);
    }
  };

  const handleFileChange = (fileId: string, content: string) => {
    setOpenFiles(prev => 
      prev.map(file => 
        file.id === fileId 
          ? { ...file, content }
          : file
      )
    );
    
    // Track unsaved changes
    setUnsavedChanges(prev => new Set([...prev, fileId]));
    
    // Update active file if it's the one being changed
    if (activeFile?.id === fileId) {
      setActiveFile(prev => prev ? { ...prev, content } : null);
    }
  };

  const handleSaveFile = async (file: File) => {
    try {
      await backend.files.save({
        projectId: projectId!,
        path: file.path,
        content: file.content || '',
        name: file.name,
      });
      
      setUnsavedChanges(prev => {
        const newChanges = new Set(prev);
        newChanges.delete(file.id);
        return newChanges;
      });
      
      toast({
        title: "Saved",
        description: `${file.name} saved successfully`,
      });
    } catch (error) {
      console.error('Error saving file:', error);
      toast({
        title: "Error",
        description: "Failed to save file",
        variant: "destructive",
      });
    }
  };

  const handleSaveAll = async () => {
    const filesToSave = openFiles.filter(file => unsavedChanges.has(file.id));
    
    try {
      await Promise.all(filesToSave.map(file => handleSaveFile(file)));
      toast({
        title: "Success",
        description: `Saved ${filesToSave.length} file(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save some files",
        variant: "destructive",
      });
    }
  };

  const handleRunProject = async () => {
    setIsRunning(true);
    try {
      // This would integrate with the execution engine
      toast({
        title: "Running",
        description: "Project execution started",
      });
      
      // Simulate execution
      setTimeout(() => {
        setIsRunning(false);
        toast({
          title: "Complete",
          description: "Project execution finished",
        });
      }, 3000);
    } catch (error) {
      setIsRunning(false);
      toast({
        title: "Error",
        description: "Failed to run project",
        variant: "destructive",
      });
    }
  };

  const handleCreateFile = async (path: string, name: string, isDirectory: boolean) => {
    try {
      if (isDirectory) {
        await backend.files.createDirectory({
          projectId: projectId!,
          path,
          name,
        });
      } else {
        await backend.files.save({
          projectId: projectId!,
          path,
          content: '',
          name,
        });
      }
      
      await loadFiles(); // Refresh file tree
      toast({
        title: "Success",
        description: `${isDirectory ? 'Folder' : 'File'} created successfully`,
      });
    } catch (error) {
      console.error('Error creating file/folder:', error);
      toast({
        title: "Error",
        description: `Failed to create ${isDirectory ? 'folder' : 'file'}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await backend.files.deleteFile({ id: fileId });
      await loadFiles(); // Refresh file tree
      
      // Close file if it was open
      handleFileClose(fileId);
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading IDE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold">{project?.name || 'Loading...'}</h1>
              {project?.status && (
                <span className="text-sm text-muted-foreground">
                  ({project.status})
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveAll}
              disabled={unsavedChanges.size === 0}
            >
              <Save className="w-4 h-4 mr-1" />
              Save All
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAI(!showAI)}
            >
              AI Assistant
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCollaboration(!showCollaboration)}
            >
              <Users className="w-4 h-4 mr-1" />
              Collaborate
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="sm"
              onClick={isRunning ? () => setIsRunning(false) : handleRunProject}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* File Tabs */}
        {openFiles.length > 0 && (
          <div className="flex items-center space-x-1 mt-2 border-t pt-2">
            {openFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center space-x-2 px-3 py-1 rounded-md cursor-pointer text-sm ${
                  activeFile?.id === file.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
                onClick={() => setActiveFile(file)}
              >
                <span>{file.name}</span>
                {unsavedChanges.has(file.id) && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileClose(file.id);
                  }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <FileExplorer
              files={files}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              projectId={projectId!}
            />
          </ResizablePanel>
          
          <ResizableHandle />
          
          {/* Editor and Terminal */}
          <ResizablePanel defaultSize={showAI || showCollaboration ? 60 : 80}>
            <ResizablePanelGroup direction="vertical">
              {/* Code Editor */}
              <ResizablePanel defaultSize={70} minSize={30}>
                {activeFile ? (
                  <CodeEditor
                    file={activeFile}
                    onChange={(content) => handleFileChange(activeFile.id, content)}
                    onSave={() => handleSaveFile(activeFile)}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-muted/20">
                    <div className="text-center space-y-4">
                      <div className="text-4xl">📝</div>
                      <div>
                        <h3 className="text-lg font-semibold">No file selected</h3>
                        <p className="text-muted-foreground">
                          Select a file from the explorer to start editing
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </ResizablePanel>
              
              <ResizableHandle />
              
              {/* Terminal */}
              <ResizablePanel defaultSize={30} minSize={20}>
                <Terminal projectId={projectId!} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          
          {/* Right Panel (AI Assistant / Collaboration) */}
          {(showAI || showCollaboration) && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                <Tabs defaultValue={showAI ? "ai" : "collaboration"} className="h-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ai" onClick={() => setShowAI(true)}>
                      AI Assistant
                    </TabsTrigger>
                    <TabsTrigger value="collaboration" onClick={() => setShowCollaboration(true)}>
                      Collaboration
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="ai" className="h-full mt-2">
                    <AIAssistant
                      projectId={projectId!}
                      activeFile={activeFile}
                      onCodeInsert={(code) => {
                        if (activeFile) {
                          const newContent = (activeFile.content || '') + '\n' + code;
                          handleFileChange(activeFile.id, newContent);
                        }
                      }}
                    />
                  </TabsContent>
                  
                  <TabsContent value="collaboration" className="h-full mt-2">
                    <CollaborationPanel projectId={projectId!} />
                  </TabsContent>
                </Tabs>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default IDEPage;