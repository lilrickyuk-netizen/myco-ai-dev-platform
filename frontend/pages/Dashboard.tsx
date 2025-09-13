import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Plus, Search, Filter, Grid, List, Sparkles, Rocket, Code, Database } from 'lucide-react';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProjectCard from '../components/ProjectCard';
import CreateProjectDialog from '../components/CreateProjectDialog';
import TemplateSelector from '../components/TemplateSelector';

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

interface AgentSession {
  id: string;
  type: string;
  status: string;
  progress: {
    percentage: number;
    currentTask?: string;
  };
  startedAt: string;
}

const Dashboard: React.FC = () => {
  const { user } = useUser();
  const backend = useBackend();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [projectsResult] = await Promise.all([
        backend.projects.list(),
      ]);
      
      setProjects(projectsResult.projects);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
      const newProject = await backend.projects.create(projectData);
      setProjects(prev => [newProject, ...prev]);
      setShowCreateDialog(false);
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await backend.projects.deleteProject({ id: projectId });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'building': return 'bg-yellow-500';
      case 'deploying': return 'bg-blue-500';
      case 'deployed': return 'bg-purple-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRecentActivity = () => {
    return [
      { action: 'Created project "E-commerce Platform"', time: '2 hours ago', icon: Plus },
      { action: 'Deployed "Blog Website" to production', time: '4 hours ago', icon: Rocket },
      { action: 'AI generated components for "Dashboard App"', time: '6 hours ago', icon: Sparkles },
      { action: 'Started collaboration session', time: '1 day ago', icon: Code },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Myco AI Platform</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateSelector(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Browse Templates
              </Button>
              
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
              
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>
                  {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-lg p-6 border">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome back, {user?.firstName || 'Developer'}! 👋
              </h2>
              <p className="text-muted-foreground mb-4">
                Ready to build something amazing? Your AI-powered development platform is at your service.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Start New Project
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateSelector(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Explore Templates
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{projects.length}</p>
                      <p className="text-sm text-muted-foreground">Total Projects</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Rocket className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {projects.filter(p => p.status === 'deployed').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Deployed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">AI Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Projects Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground">Your Projects</h3>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="creating">Creating</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="building">Building</SelectItem>
                    <SelectItem value="deployed">Deployed</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Projects Grid/List */}
              {filteredProjects.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Code className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Get started by creating your first project.'}
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                      <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Project
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className={viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                  : 'space-y-4'
                }>
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      viewMode={viewMode}
                      onDelete={handleDeleteProject}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getRecentActivity().map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mt-0.5">
                      <activity.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowTemplateSelector(true)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Browse Templates
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Code className="w-4 h-4 mr-2" />
                  Import Repository
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateProject={handleCreateProject}
      />
      
      <TemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onSelectTemplate={(template) => {
          setShowTemplateSelector(false);
          setShowCreateDialog(true);
        }}
      />
    </div>
  );
};

export default Dashboard;