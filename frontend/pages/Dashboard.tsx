import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserButton } from '@clerk/clerk-react';
import { Plus, FolderOpen, Settings, Code, Sparkles, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import ProjectCard from '../components/ProjectCard';
import CreateProjectDialog from '../components/CreateProjectDialog';
import TemplateSelector from '../components/TemplateSelector';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const backend = useBackend();
  const { toast } = useToast();

  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        return await backend.projects.list();
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        toast({
          title: 'Error',
          description: 'Failed to load projects',
          variant: 'destructive',
        });
        throw error;
      }
    },
  });

  const { data: userInfo } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        return await backend.auth.getUserInfo();
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        return null;
      }
    },
  });

  const filteredProjects = projectsData?.projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">Myco</span>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Multi-Agent Platform
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(true)}
              >
                <Code className="h-4 w-4 mr-2" />
                Templates
              </Button>
              
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back{userInfo?.firstName ? `, ${userInfo.firstName}` : ''}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Build, collaborate, and deploy with AI-powered development tools.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowCreateDialog(true)}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Create Project</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Start a new project with AI-powered scaffolding and templates.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowTemplates(true)}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Code className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Browse Templates</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Explore pre-built templates for React, Node.js, Python, and more.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Assistant</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get help with code generation, debugging, and architecture.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>{filteredProjects.length} projects</span>
            </div>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onUpdate={refetch} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search terms.'
                  : 'Create your first project to get started building with AI.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={refetch}
      />
      
      <TemplateSelector
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelectTemplate={(template) => {
          setShowTemplates(false);
          setShowCreateDialog(true);
        }}
      />
    </div>
  );
}
