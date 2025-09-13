import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Settings, Trash2, Users, Upload, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBackend } from '../hooks/useBackend';
import type { Project } from '~backend/projects/types';

export default function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      return await backend.projects.get({ id: projectId });
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/ide/${projectId}`)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to IDE
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-muted-foreground">Project Settings</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  General
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Collaborators
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  Deployment
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Security
                </Button>
                <Button variant="ghost" className="w-full justify-start text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Danger Zone
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>
                  Basic project information and configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Project Name</label>
                    <p className="text-sm text-muted-foreground mt-1">{project.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.description || 'No description provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Template</label>
                    <p className="text-sm text-muted-foreground mt-1">{project.template}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Created</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collaborators */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Collaborators
                </CardTitle>
                <CardDescription>
                  Manage team members and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No collaborators yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Invite team members to collaborate on this project.
                  </p>
                  <Button>Invite Collaborators</Button>
                </div>
              </CardContent>
            </Card>

            {/* Deployment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Deploy className="h-5 w-5 mr-2" />
                  Deployment
                </CardTitle>
                <CardDescription>
                  Configure deployment settings and environments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Deploy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No deployments configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Set up automatic deployments to your preferred cloud provider.
                  </p>
                  <Button>Configure Deployment</Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <Trash2 className="h-5 w-5 mr-2" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border border-destructive rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Delete Project</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete the project and all its data. This action cannot be undone.
                    </p>
                    <Button variant="destructive" size="sm">
                      Delete Project
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
