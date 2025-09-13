import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  File as FileIcon, 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreHorizontal,
  FileText,
  Image,
  Code,
  Database,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface File {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirectory: boolean;
  children?: File[];
}

interface FileExplorerProps {
  files: File[];
  onFileSelect: (file: File) => void;
  onCreateFile: (path: string, name: string, isDirectory: boolean) => void;
  onDeleteFile: (fileId: string) => void;
  projectId: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  projectId
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingFile, setCreatingFile] = useState<{ parentPath: string; isDirectory: boolean } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ file: File; open: boolean }>({ file: null as any, open: false });

  const getFileIcon = (file: File) => {
    if (file.isDirectory) {
      return expandedFolders.has(file.id) ? FolderOpen : Folder;
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'go':
      case 'rs':
        return Code;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return Image;
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'toml':
        return Database;
      case 'md':
      case 'txt':
      case 'doc':
      case 'docx':
        return FileText;
      case 'config':
      case 'env':
      case 'gitignore':
        return Settings;
      default:
        return FileIcon;
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFile = (parentPath: string, isDirectory: boolean) => {
    setCreatingFile({ parentPath, isDirectory });
    setNewFileName('');
  };

  const handleSubmitCreate = () => {
    if (!newFileName.trim() || !creatingFile) return;
    
    const fullPath = creatingFile.parentPath ? 
      `${creatingFile.parentPath}/${newFileName}` : 
      newFileName;
    
    onCreateFile(fullPath, newFileName, creatingFile.isDirectory);
    setCreatingFile(null);
    setNewFileName('');
  };

  const handleCancelCreate = () => {
    setCreatingFile(null);
    setNewFileName('');
  };

  const handleDeleteFile = (file: File) => {
    setDeleteDialog({ file, open: true });
  };

  const confirmDelete = () => {
    if (deleteDialog.file) {
      onDeleteFile(deleteDialog.file.id);
      setDeleteDialog({ file: null as any, open: false });
    }
  };

  const renderFile = (file: File, level: number = 0) => {
    const Icon = getFileIcon(file);
    const isExpanded = expandedFolders.has(file.id);
    const indent = level * 16;

    return (
      <div key={file.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center space-x-2 px-2 py-1 hover:bg-muted/50 cursor-pointer rounded-sm group`}
              style={{ paddingLeft: `${8 + indent}px` }}
              onClick={() => {
                if (file.isDirectory) {
                  toggleFolder(file.id);
                } else {
                  onFileSelect(file);
                }
              }}
            >
              {file.isDirectory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(file.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              )}
              
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate flex-1">{file.name}</span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {file.isDirectory && (
                    <>
                      <DropdownMenuItem onClick={() => handleCreateFile(file.path, false)}>
                        <FileIcon className="h-4 w-4 mr-2" />
                        New File
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCreateFile(file.path, true)}>
                        <Folder className="h-4 w-4 mr-2" />
                        New Folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => handleDeleteFile(file)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          
          <ContextMenuContent>
            {file.isDirectory && (
              <>
                <ContextMenuItem onClick={() => handleCreateFile(file.path, false)}>
                  <FileIcon className="h-4 w-4 mr-2" />
                  New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCreateFile(file.path, true)}>
                  <Folder className="h-4 w-4 mr-2" />
                  New Folder
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem 
              className="text-red-600"
              onClick={() => handleDeleteFile(file)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Render children if directory is expanded */}
        {file.isDirectory && isExpanded && file.children && (
          <div>
            {file.children.map(child => renderFile(child, level + 1))}
          </div>
        )}

        {/* Inline file creation */}
        {creatingFile && creatingFile.parentPath === file.path && (
          <div
            className="flex items-center space-x-2 px-2 py-1"
            style={{ paddingLeft: `${24 + indent}px` }}
          >
            {creatingFile.isDirectory ? (
              <Folder className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileIcon className="h-4 w-4 text-muted-foreground" />
            )}
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitCreate();
                } else if (e.key === 'Escape') {
                  handleCancelCreate();
                }
              }}
              onBlur={handleCancelCreate}
              className="h-6 text-sm"
              placeholder={creatingFile.isDirectory ? 'Folder name' : 'File name'}
              autoFocus
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col border-r bg-card/50">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Explorer</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreateFile('', false)}>
                <FileIcon className="h-4 w-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateFile('', true)}>
                <Folder className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files yet</p>
              <p className="text-xs">Create your first file</p>
            </div>
          ) : (
            files.map(file => renderFile(file))
          )}

          {/* Root level file creation */}
          {creatingFile && creatingFile.parentPath === '' && (
            <div className="flex items-center space-x-2 px-2 py-1">
              {creatingFile.isDirectory ? (
                <Folder className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitCreate();
                  } else if (e.key === 'Escape') {
                    handleCancelCreate();
                  }
                }}
                onBlur={handleCancelCreate}
                className="h-6 text-sm"
                placeholder={creatingFile.isDirectory ? 'Folder name' : 'File name'}
                autoFocus
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.file?.isDirectory ? 'Folder' : 'File'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.file?.name}"? 
              {deleteDialog.file?.isDirectory && ' This will delete all files in the folder.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export { FileExplorer };
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  Trash2,
  Edit,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useBackend } from "../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import type { FileNode } from "~backend/filesystem/types";

interface FileExplorerProps {
  projectId: string;
  files: FileNode[];
  currentFile: FileNode | null;
  onFileSelect: (file: FileNode) => void;
  onFileCreated: (file: FileNode) => void;
  onFileDeleted: (path: string) => void;
}

interface FileTreeProps {
  files: FileNode[];
  currentFile: FileNode | null;
  onFileSelect: (file: FileNode) => void;
  onRename: (file: FileNode, newName: string) => void;
  onDelete: (file: FileNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  level?: number;
}

function FileTree({ 
  files, 
  currentFile, 
  onFileSelect, 
  onRename, 
  onDelete,
  onCreateFile,
  onCreateFolder,
  level = 0 
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["/"]));
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const startRename = (file: FileNode) => {
    setEditingFile(file.path);
    setEditName(file.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const finishRename = () => {
    if (editingFile && editName.trim()) {
      const file = files.find(f => f.path === editingFile);
      if (file && editName !== file.name) {
        onRename(file, editName.trim());
      }
    }
    setEditingFile(null);
    setEditName("");
  };

  const cancelRename = () => {
    setEditingFile(null);
    setEditName("");
  };

  const buildFileTree = (parentPath: string): FileNode[] => {
    return files
      .filter(file => {
        if (parentPath === "/") {
          return !file.path.includes("/") || file.path === "/";
        }
        const relativePath = file.path.startsWith(parentPath + "/") 
          ? file.path.slice(parentPath.length + 1)
          : "";
        return relativePath && !relativePath.includes("/");
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  };

  const renderFile = (file: FileNode) => {
    const isSelected = currentFile?.path === file.path;
    const isExpanded = expandedFolders.has(file.path);
    const isEditing = editingFile === file.path;
    const childFiles = file.type === "directory" ? buildFileTree(file.path) : [];

    return (
      <div key={file.path}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer hover:bg-accent ${
                isSelected ? "bg-accent" : ""
              }`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() => {
                if (file.type === "directory") {
                  toggleFolder(file.path);
                } else {
                  onFileSelect(file);
                }
              }}
            >
              {file.type === "directory" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(file.path);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              )}
              
              {file.type === "directory" ? (
                isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500" />
                )
              ) : (
                <File className="h-4 w-4 text-muted-foreground" />
              )}

              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      finishRename();
                    } else if (e.key === "Escape") {
                      cancelRename();
                    }
                  }}
                  className="h-6 py-0 px-1 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate">{file.name}</span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-auto opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => startRename(file)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  {file.type === "directory" && (
                    <>
                      <DropdownMenuItem onClick={() => onCreateFile(file.path)}>
                        <File className="h-4 w-4 mr-2" />
                        New File
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCreateFolder(file.path)}>
                        <Folder className="h-4 w-4 mr-2" />
                        New Folder
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={() => onDelete(file)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => startRename(file)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </ContextMenuItem>
            {file.type === "directory" && (
              <>
                <ContextMenuItem onClick={() => onCreateFile(file.path)}>
                  <File className="h-4 w-4 mr-2" />
                  New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onCreateFolder(file.path)}>
                  <Folder className="h-4 w-4 mr-2" />
                  New Folder
                </ContextMenuItem>
              </>
            )}
            <ContextMenuItem 
              onClick={() => onDelete(file)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {file.type === "directory" && isExpanded && childFiles.length > 0 && (
          <FileTree
            files={childFiles}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
            onRename={onRename}
            onDelete={onDelete}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            level={level + 1}
          />
        )}
      </div>
    );
  };

  const rootFiles = buildFileTree("/");

  return (
    <div className="space-y-1">
      {rootFiles.map(renderFile)}
    </div>
  );
}

export function FileExplorer({
  projectId,
  files,
  currentFile,
  onFileSelect,
  onFileCreated,
  onFileDeleted
}: FileExplorerProps) {
  const backend = useBackend();
  const { toast } = useToast();

  const handleRename = async (file: FileNode, newName: string) => {
    try {
      const newPath = file.path.replace(file.name, newName);
      await backend.filesystem.rename({
        projectId,
        oldPath: file.path,
        newPath
      });
      
      // Update the file in the list
      onFileCreated({ ...file, name: newName, path: newPath });
      onFileDeleted(file.path);
      
      toast({
        title: "File Renamed",
        description: `${file.name} renamed to ${newName}`
      });
    } catch (err) {
      console.error("Failed to rename file:", err);
      toast({
        title: "Error",
        description: "Failed to rename file.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (file: FileNode) => {
    try {
      await backend.filesystem.delete({
        projectId,
        path: file.path
      });
      
      onFileDeleted(file.path);
      
      toast({
        title: "File Deleted",
        description: `${file.name} has been deleted`
      });
    } catch (err) {
      console.error("Failed to delete file:", err);
      toast({
        title: "Error",
        description: "Failed to delete file.",
        variant: "destructive"
      });
    }
  };

  const handleCreateFile = async (parentPath: string) => {
    const fileName = prompt("Enter file name:");
    if (!fileName) return;

    try {
      const filePath = parentPath === "/" ? fileName : `${parentPath}/${fileName}`;
      const newFile = await backend.filesystem.create({
        projectId,
        path: filePath,
        type: "file",
        content: ""
      });
      
      onFileCreated(newFile);
      
      toast({
        title: "File Created",
        description: `${fileName} has been created`
      });
    } catch (err) {
      console.error("Failed to create file:", err);
      toast({
        title: "Error",
        description: "Failed to create file.",
        variant: "destructive"
      });
    }
  };

  const handleCreateFolder = async (parentPath: string) => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    try {
      const folderPath = parentPath === "/" ? folderName : `${parentPath}/${folderName}`;
      const newFolder = await backend.filesystem.create({
        projectId,
        path: folderPath,
        type: "directory"
      });
      
      onFileCreated(newFolder);
      
      toast({
        title: "Folder Created",
        description: `${folderName} has been created`
      });
    } catch (err) {
      console.error("Failed to create folder:", err);
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full flex flex-col border-r bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Explorer</h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCreateFile("/")}
              className="h-6 w-6 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        <FileTree
          files={files}
          currentFile={currentFile}
          onFileSelect={onFileSelect}
          onRename={handleRename}
          onDelete={handleDelete}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
        />
      </div>
    </div>
  );
}
