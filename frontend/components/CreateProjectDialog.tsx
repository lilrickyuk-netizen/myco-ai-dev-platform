import React, { useState, useEffect } from 'react';
import { X, Sparkles, Code, Globe, Smartphone, Database, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Template {
  type: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  tags: string[];
  framework: string;
  language: string;
  features: string[];
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (projectData: any) => void;
  selectedTemplate?: Template;
}

const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onOpenChange,
  onCreateProject,
  selectedTemplate
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateType: selectedTemplate?.type || '',
    templateName: selectedTemplate?.name || '',
  });
  const [selectedTemplateData, setSelectedTemplateData] = useState<Template | null>(selectedTemplate || null);
  const [loading, setLoading] = useState(false);

  const templates: Template[] = [
    {
      type: 'web',
      name: 'react-typescript',
      displayName: 'React + TypeScript',
      description: 'Modern React application with TypeScript, Vite, and Tailwind CSS',
      icon: '⚛️',
      tags: ['Frontend', 'SPA', 'Modern'],
      framework: 'React',
      language: 'TypeScript',
      features: ['Hot Reload', 'TypeScript', 'Tailwind CSS', 'Vite']
    },
    {
      type: 'web',
      name: 'nextjs-typescript',
      displayName: 'Next.js + TypeScript',
      description: 'Full-stack React framework with SSR, API routes, and TypeScript',
      icon: '🔺',
      tags: ['Fullstack', 'SSR', 'API Routes'],
      framework: 'Next.js',
      language: 'TypeScript',
      features: ['Server-Side Rendering', 'API Routes', 'Image Optimization', 'TypeScript']
    },
    {
      type: 'backend',
      name: 'express-typescript',
      displayName: 'Express + TypeScript',
      description: 'RESTful API with Express.js, TypeScript, and comprehensive middleware',
      icon: '🚀',
      tags: ['Backend', 'API', 'Express'],
      framework: 'Express',
      language: 'TypeScript',
      features: ['REST API', 'Middleware', 'TypeScript', 'Authentication Ready']
    },
    {
      type: 'backend',
      name: 'nestjs-typescript',
      displayName: 'NestJS + TypeScript',
      description: 'Enterprise-grade Node.js framework with decorators and dependency injection',
      icon: '🐈',
      tags: ['Backend', 'Enterprise', 'Scalable'],
      framework: 'NestJS',
      language: 'TypeScript',
      features: ['Dependency Injection', 'Decorators', 'Guards', 'Interceptors']
    },
    {
      type: 'fullstack',
      name: 'mern-stack',
      displayName: 'MERN Stack',
      description: 'Full-stack application with MongoDB, Express, React, and Node.js',
      icon: '🔧',
      tags: ['Fullstack', 'MERN', 'MongoDB'],
      framework: 'MERN',
      language: 'JavaScript',
      features: ['MongoDB', 'Express', 'React', 'Node.js']
    },
    {
      type: 'fullstack',
      name: 't3-stack',
      displayName: 'T3 Stack',
      description: 'Type-safe full-stack with Next.js, tRPC, Prisma, and TypeScript',
      icon: '🏗️',
      tags: ['Fullstack', 'Type-safe', 'Modern'],
      framework: 'T3',
      language: 'TypeScript',
      features: ['tRPC', 'Prisma', 'NextAuth', 'TypeScript']
    },
    {
      type: 'mobile',
      name: 'react-native',
      displayName: 'React Native',
      description: 'Cross-platform mobile app with React Native and Expo',
      icon: '📱',
      tags: ['Mobile', 'Cross-platform', 'React'],
      framework: 'React Native',
      language: 'TypeScript',
      features: ['Cross-platform', 'Expo', 'Native Components', 'Hot Reload']
    },
    {
      type: 'ai',
      name: 'ai-chatbot',
      displayName: 'AI Chatbot',
      description: 'Intelligent chatbot with OpenAI integration and conversation management',
      icon: '🤖',
      tags: ['AI', 'Chatbot', 'OpenAI'],
      framework: 'React',
      language: 'TypeScript',
      features: ['OpenAI Integration', 'Chat Interface', 'Context Management', 'Streaming']
    }
  ];

  useEffect(() => {
    if (selectedTemplate) {
      setSelectedTemplateData(selectedTemplate);
      setFormData(prev => ({
        ...prev,
        templateType: selectedTemplate.type,
        templateName: selectedTemplate.name,
      }));
      setStep(2);
    }
  }, [selectedTemplate]);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplateData(template);
    setFormData(prev => ({
      ...prev,
      templateType: template.type,
      templateName: template.name,
    }));
    setStep(2);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setLoading(true);
    try {
      await onCreateProject(formData);
      // Reset form
      setFormData({
        name: '',
        description: '',
        templateType: '',
        templateName: '',
      });
      setSelectedTemplateData(null);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setFormData({
      name: '',
      description: '',
      templateType: '',
      templateName: '',
    });
    setSelectedTemplateData(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'web': return <Globe className="w-5 h-5" />;
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'backend': return <Database className="w-5 h-5" />;
      case 'fullstack': return <Code className="w-5 h-5" />;
      case 'ai': return <Brain className="w-5 h-5" />;
      default: return <Code className="w-5 h-5" />;
    }
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.type]) {
      acc[template.type] = [];
    }
    acc[template.type].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5" />
            <span>Create New Project</span>
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Choose a template to get started quickly with best practices and modern tooling.'
              : 'Configure your project details and preferences.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 1 && (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedTemplates).map(([type, typeTemplates]) => (
                  <div key={type} className="space-y-3">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(type)}
                      <h3 className="text-lg font-semibold capitalize">{type} Templates</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {typeTemplates.map((template) => (
                        <Card 
                          key={template.name}
                          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-2xl">{template.icon}</span>
                                <div>
                                  <CardTitle className="text-base">{template.displayName}</CardTitle>
                                  <CardDescription className="text-sm">
                                    {template.framework} • {template.language}
                                  </CardDescription>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                            
                            <div className="flex flex-wrap gap-1">
                              {template.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              Features: {template.features.slice(0, 2).join(', ')}
                              {template.features.length > 2 && '...'}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {step === 2 && selectedTemplateData && (
            <div className="space-y-6">
              {/* Selected Template Summary */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{selectedTemplateData.icon}</span>
                      <div>
                        <CardTitle className="text-base">{selectedTemplateData.displayName}</CardTitle>
                        <CardDescription>{selectedTemplateData.framework} • {selectedTemplateData.language}</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplateData.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Project Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    placeholder="Enter project name..."
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Describe your project (optional)..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-2">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>
                Back to Templates
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            {step === 2 && (
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.name.trim() || loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { CreateProjectDialog };
