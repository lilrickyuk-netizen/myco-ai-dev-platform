import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Folder, 
  FolderOpen, 
  File, 
  Plus, 
  FolderPlus, 
  MoreHorizontal,
  Trash2,
  Edit,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import type { FileTreeNode } from '~backend/files/types';

interface FileExplorerProps {
  projectId: string;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
}

interface FileNodeProps {
  node: FileTreeNode;
  level: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (filePath: string) => void;
  selectedFile: string | null;
  projectId: string;
}

export default function FileExplorer({ projectId, selectedFile, onSelectFile }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState(new Set<string>());
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; path: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: filesData, isLoading } = useQuery({
    queryKey: ['files', projectId],
    queryFn: async () => {
      try {
        return await backend.files.list({ projectId });
      } catch (error) {
        console.error('Failed to fetch files:', error);
        toast({
          title: 'Error',
          description: 'Failed to load files',
          variant: 'destructive',
        });
        return { files: [] };
      }
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return await backend.files.save({ projectId, path, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      toast({
        title: 'File created',
        description: 'File has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to create file:', error);
      toast({
        title: 'Error',
        description: 'Failed to create file',
        variant: 'destructive',
      });
    },
  });

  const createDirectoryMutation = useMutation({
    mutationFn: async (path: string) => {
      return await backend.files.createDirectory({ projectId, path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      toast({
        title: 'Folder created',
        description: 'Folder has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to create directory:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        variant: 'destructive',
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (path: string) => {
      return await backend.files.deleteFile({ projectId, path });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      toast({
        title: 'Item deleted',
        description: 'Item has been deleted successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to delete file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    },
  });

  const handleToggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateItem = (type: 'file' | 'folder', basePath: string = '') => {
    setIsCreating({ type, path: basePath });
    setNewItemName('');
  };

  const handleConfirmCreate = () => {
    if (!isCreating || !newItemName.trim()) return;

    const fullPath = isCreating.path 
      ? `${isCreating.path}/${newItemName.trim()}`
      : newItemName.trim();

    if (isCreating.type === 'file') {
      createFileMutation.mutate({ path: fullPath, content: '' });
    } else {
      createDirectoryMutation.mutate(fullPath);
    }

    setIsCreating(null);
    setNewItemName('');
  };

  const handleCancelCreate = () => {
    setIsCreating(null);
    setNewItemName('');
  };

  const handleDelete = (path: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteFileMutation.mutate(path);
    }
  };

  const buildFileTree = (files: FileTreeNode[]): FileTreeNode[] => {
    const tree: FileTreeNode[] = [];
    const pathMap = new Map<string, FileTreeNode>();

    // Sort files: directories first, then by name
    const sortedFiles = [...files].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const file of sortedFiles) {
      const node: FileTreeNode = {
        ...file,
        children: file.isDirectory ? [] : undefined,
      };
      
      pathMap.set(file.path, node);
      
      const parentPath = file.path.split('/').slice(0, -1).join('/');
      const parent = parentPath ? pathMap.get(parentPath) : null;
      
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    }

    return tree;
  };

  const FileNode: React.FC<FileNodeProps> = ({
    node,
    level,
    expandedFolders,
    onToggleFolder,
    onSelectFile,
    selectedFile,
    projectId,
  }) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div>
        <div
          className={`flex items-center py-1 px-2 hover:bg-accent cursor-pointer group ${
            isSelected ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              onToggleFolder(node.path);
            } else {
              onSelectFile(node.path);
            }
          }}
        >
          <div className="flex items-center flex-1 min-w-0">
            {node.isDirectory ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
              )
            ) : (
              <File className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm truncate">{node.name}</span>
            {!node.isDirectory && node.size && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatFileSize(node.size)}
              </span>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {node.isDirectory && (
                <>
                  <DropdownMenuItem onClick={() => handleCreateItem('file', node.path)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCreateItem('folder', node.path)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => handleDelete(node.path)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileNode
                key={child.path}
                node={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
                projectId={projectId}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = buildFileTree(filesData?.files || []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Explorer</h3>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleCreateItem('file')}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleCreateItem('folder')}
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading files...
          </div>
        ) : (
          <div className="py-2">
            {isCreating && !isCreating.path && (
              <div className="flex items-center px-2 py-1" style={{ paddingLeft: '8px' }}>
                {isCreating.type === 'folder' ? (
                  <Folder className="h-4 w-4 mr-2 text-blue-500" />
                ) : (
                  <File className="h-4 w-4 mr-2 text-muted-foreground" />
                )}
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCreate();
                    if (e.key === 'Escape') handleCancelCreate();
                  }}
                  onBlur={handleCancelCreate}
                  placeholder={`New ${isCreating.type}...`}
                  className="h-6 text-sm border-none p-0 focus-visible:ring-0"
                  autoFocus
                />
              </div>
            )}
            
            {fileTree.map((node) => (
              <FileNode
                key={node.path}
                node={node}
                level={0}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
                projectId={projectId}
              />
            ))}
            
            {fileTree.length === 0 && !isCreating && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No files yet. Create your first file to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
