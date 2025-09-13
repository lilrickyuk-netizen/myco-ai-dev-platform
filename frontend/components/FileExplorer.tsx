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
  projectId: string;
  files: File[];
  activeFile?: File | null;
  onFileSelect: (file: File) => void;
  onFileCreate?: (type: 'file' | 'folder', parentPath?: string) => void;
  onFileDelete?: (file: File) => void;
  onFileRename?: (file: File, newName: string) => void;
}

const getFileIcon = (file: File) => {
  if (file.isDirectory) return Folder;
  
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
      return Code;
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return Database;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return Image;
    case 'md':
    case 'txt':
      return FileText;
    default:
      return FileIcon;
  }
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  projectId,
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contextMenuFile, setContextMenuFile] = useState<File | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<File | null>(null);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (file: File) => {
    if (file.isDirectory) {
      toggleFolder(file.path);
    } else {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const startRename = (file: File) => {
    setIsRenaming(file.path);
    setRenameValue(file.name);
  };

  const handleRename = (file: File) => {
    if (renameValue && renameValue !== file.name && onFileRename) {
      onFileRename(file, renameValue);
    }
    setIsRenaming(null);
    setRenameValue('');
  };

  const handleDelete = (file: File) => {
    setDeleteConfirm(file);
  };

  const confirmDelete = () => {
    if (deleteConfirm && onFileDelete) {
      onFileDelete(deleteConfirm);
    }
    setDeleteConfirm(null);
  };

  const buildFileTree = (files: File[], parentPath = '') => {
    const tree: File[] = [];
    const pathLevel = parentPath.split('/').filter(Boolean).length;

    files.forEach(file => {
      const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
      const pathParts = filePath.split('/').filter(Boolean);
      
      if (pathParts.length === pathLevel + 1) {
        const isInParent = parentPath === '' || filePath.startsWith(parentPath);
        if (isInParent) {
          tree.push(file);
        }
      }
    });

    return tree.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const renderFileTree = (files: File[], level = 0, parentPath = '') => {
    const currentFiles = buildFileTree(files, parentPath);

    return currentFiles.map(file => {
      const isExpanded = expandedFolders.has(file.path);
      const isSelected = activeFile?.path === file.path;
      const isBeingRenamed = isRenaming === file.path;
      const Icon = getFileIcon(file);

      return (
        <div key={file.path}>
          <ContextMenuTrigger>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-accent group ${
                isSelected ? 'bg-accent' : ''
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => handleFileClick(file)}
            >
              {file.isDirectory && (
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
              
              {!file.isDirectory && <div className="w-4" />}
              
              <Icon className="h-4 w-4 flex-shrink-0" />
              
              {isBeingRenamed ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRename(file);
                    } else if (e.key === 'Escape') {
                      setIsRenaming(null);
                    }
                  }}
                  onBlur={() => handleRename(file)}
                  className="h-6 text-xs flex-1"
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm truncate">
                  {file.name}
                </span>
              )}
              
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
                <DropdownMenuContent>
                  {file.isDirectory && (
                    <>
                      <DropdownMenuItem onClick={() => onFileCreate?.('file', file.path)}>
                        <FileIcon className="h-4 w-4 mr-2" />
                        New File
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onFileCreate?.('folder', file.path)}>
                        <Folder className="h-4 w-4 mr-2" />
                        New Folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => startRename(file)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(file)}
                    className="text-destructive"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          
          {file.isDirectory && isExpanded && (
            <div>
              {renderFileTree(files, level + 1, file.path)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Explorer</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFileCreate?.('file')}
            className="h-6 w-6 p-0"
            title="New File"
          >
            <FileIcon className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFileCreate?.('folder')}
            className="h-6 w-6 p-0"
            title="New Folder"
          >
            <Folder className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          <ContextMenu>
            <div className="space-y-1">
              {renderFileTree(files)}
            </div>
            
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onFileCreate?.('file')}>
                <FileIcon className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onFileCreate?.('folder')}>
                <Folder className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </ScrollArea>
      
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FileExplorer;