import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Code, MoreVertical, Trash2, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import type { Project } from '~backend/projects/types';

interface ProjectCardProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await backend.projects.deleteProject({ id: project.id });
      toast({
        title: 'Project deleted',
        description: `${project.name} has been deleted successfully.`,
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      'react-typescript': 'React + TS',
      'vue-typescript': 'Vue + TS',
      'angular-typescript': 'Angular + TS',
      'nodejs-express': 'Node.js',
      'python-fastapi': 'Python',
      'java-spring': 'Java',
      'go-gin': 'Go',
      'nextjs-typescript': 'Next.js',
      'nuxt-typescript': 'Nuxt.js',
      'svelte-typescript': 'Svelte',
    };
    return labels[template] || template;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1" onClick={() => navigate(`/ide/${project.id}`)}>
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {project.name}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {getTemplateLabel(project.template)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {project.status}
              </Badge>
            </div>
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
              <DropdownMenuItem onClick={() => navigate(`/ide/${project.id}`)}>
                <Code className="h-4 w-4 mr-2" />
                Open IDE
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}/settings`)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent onClick={() => navigate(`/ide/${project.id}`)}>
        <CardDescription className="mb-4 line-clamp-2">
          {project.description || 'No description provided for this project.'}
        </CardDescription>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            Updated {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
