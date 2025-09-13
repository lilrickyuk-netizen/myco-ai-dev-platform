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

export default FileExplorer;