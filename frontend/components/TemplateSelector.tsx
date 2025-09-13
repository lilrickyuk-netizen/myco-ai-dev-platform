import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Code, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBackend } from '../hooks/useBackend';
import type { Template } from '~backend/ai/templates';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Template) => void;
}

export default function TemplateSelector({ open, onOpenChange, onSelectTemplate }: TemplateSelectorProps) {
  const backend = useBackend();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      try {
        return await backend.ai.getTemplates();
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        return { templates: [] };
      }
    },
    enabled: open,
  });

  const templates = templatesData?.templates || [];
  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Code className="h-5 w-5 mr-2 text-primary" />
            Project Templates
          </DialogTitle>
          <DialogDescription>
            Choose from our collection of professionally crafted templates to kickstart your project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates
                      .filter(template => template.category === category)
                      .map((template) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:shadow-lg transition-all"
                          onClick={() => onSelectTemplate(template)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <CardDescription className="mb-3">
                              {template.description}
                            </CardDescription>
                            
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="text-xs">
                                  {template.language}
                                </Badge>
                                {template.framework && (
                                  <Badge variant="outline" className="text-xs">
                                    {template.framework}
                                  </Badge>
                                )}
                              </div>
                              
                              {template.dependencies && template.dependencies.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Includes: {template.dependencies.slice(0, 3).join(', ')}
                                  {template.dependencies.length > 3 && ` +${template.dependencies.length - 3} more`}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
