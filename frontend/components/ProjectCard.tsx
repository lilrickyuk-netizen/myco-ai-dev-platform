import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Code, 
  ExternalLink, 
  Settings, 
  Trash2, 
  Clock, 
  GitBranch, 
  Globe,
  Play,
  MoreHorizontal,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
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

interface Project {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  templateName: string;
  status: string;
  gitUrl?: string;
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectCardProps {
  project: Project;
  viewMode: 'grid' | 'list';
  onDelete: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, viewMode, onDelete }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'building': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'deploying': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'deployed': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'creating': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getTemplateIcon = (templateType: string) => {
    switch (templateType) {
      case 'web': return '🌐';
      case 'mobile': return '📱';
      case 'backend': return '⚙️';
      case 'fullstack': return '🔧';
      case 'ai': return '🤖';
      default: return '💻';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    return `${days}d ago`;
  };

  const handleDelete = () => {
    onDelete(project.id);
    setShowDeleteDialog(false);
  };

  if (viewMode === 'list') {
    return (
      <>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className="text-2xl">{getTemplateIcon(project.templateType)}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Created {formatDate(project.createdAt)}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Updated {formatTimeAgo(project.updatedAt)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {project.templateName}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {project.deployUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={project.deployUrl} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/ide/${project.id}`}>
                    <Play className="w-4 h-4 mr-1" />
                    Open
                  </Link>
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${project.id}/settings`}>
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {project.gitUrl && (
                      <DropdownMenuItem asChild>
                        <a href={project.gitUrl} target="_blank" rel="noopener noreferrer">
                          <GitBranch className="w-4 h-4 mr-2" />
                          Repository
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{project.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">{getTemplateIcon(project.templateType)}</div>
              <div>
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/projects/${project.id}/settings`}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {project.gitUrl && (
                  <DropdownMenuItem asChild>
                    <a href={project.gitUrl} target="_blank" rel="noopener noreferrer">
                      <GitBranch className="w-4 h-4 mr-2" />
                      Repository
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {project.templateName}
            </Badge>
          </div>
          
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Created {formatDate(project.createdAt)}
            </div>
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Updated {formatTimeAgo(project.updatedAt)}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <Button size="sm" className="flex-1" asChild>
              <Link to={`/ide/${project.id}`}>
                <Code className="w-4 h-4 mr-1" />
                Open IDE
              </Link>
            </Button>
            
            {project.deployUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={project.deployUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectCard;import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MoreVertical, 
  Calendar, 
  FileText, 
  ExternalLink, 
  Trash2,
  Edit,
  Play,
  Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useBackend } from "../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import type { Project } from "~backend/project/types";

interface ProjectCardProps {
  project: Project;
  onDeleted: () => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const handleOpen = () => {
    navigate(`/ide/${project.id}`);
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await backend.project.delete({ id: project.id });
      onDeleted();
      toast({
        title: "Project Deleted",
        description: `${project.name} has been deleted.`
      });
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getTimeSince = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) {
      return formatDate(date);
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else {
      return "Just now";
    }
  };

  const getStatusColor = () => {
    const daysSinceUpdate = Math.floor(
      (new Date().getTime() - new Date(project.updatedAt).getTime()) / 
      (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate < 1) return "bg-green-500";
    if (daysSinceUpdate < 7) return "bg-yellow-500";
    return "bg-gray-500";
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0" onClick={handleOpen}>
              <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
              {project.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleOpen}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open IDE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpen}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/project/${project.id}/settings`)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent onClick={handleOpen} className="pt-0">
          <div className="space-y-3">
            {/* Template Badge */}
            {project.template && project.template !== "blank" && (
              <Badge variant="secondary" className="text-xs">
                {project.template}
              </Badge>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{project.fileCount || 0} files</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Created {formatDate(project.createdAt)}</span>
              </div>
            </div>

            {/* Last Modified */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                <span>Updated {getTimeSince(project.updatedAt)}</span>
              </div>
              
              <Button 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpen();
                }}
              >
                Open
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone
              and will permanently delete all files in this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
