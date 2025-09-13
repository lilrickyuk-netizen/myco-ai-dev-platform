import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Code, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';
import type { ProjectTemplate } from '~backend/projects/types';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '' as ProjectTemplate | '',
  });
  const navigate = useNavigate();
  const backend = useBackend();
  const { toast } = useToast();

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      try {
        return await backend.ai.getTemplates();
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        return { templates: [] };
      }
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!formData.template) throw new Error('Template is required');
      
      return await backend.projects.create({
        name: formData.name,
        description: formData.description || undefined,
        template: formData.template,
      });
    },
    onSuccess: (project) => {
      toast({
        title: 'Project created',
        description: `${project.name} has been created successfully.`,
      });
      onSuccess();
      onOpenChange(false);
      navigate(`/ide/${project.id}`);
      
      // Reset form
      setFormData({ name: '', description: '', template: '' });
      setStep(1);
    },
    onError: (error) => {
      console.error('Failed to create project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleNext = () => {
    if (step === 1 && formData.name.trim()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleCreate = () => {
    if (formData.name.trim() && formData.template) {
      createProjectMutation.mutate();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ name: '', description: '', template: '' });
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-primary" />
            Create New Project
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Set up your project details and let AI help you get started.'
              : 'Choose a template to scaffold your project structure.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="A brief description of your project..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext} disabled={!formData.name.trim()}>
                Next: Choose Template
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {templates?.templates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    formData.template === template.id
                      ? 'ring-2 ring-primary bg-accent'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setFormData({ ...formData, template: template.id as ProjectTemplate })}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2">
                      <Code className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded">
                        {template.language}
                      </span>
                      {template.framework && (
                        <span className="text-xs px-2 py-1 bg-muted rounded">
                          {template.framework}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.template || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
