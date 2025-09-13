import React, { useState } from 'react';
import { Search, Filter, Code, Globe, Smartphone, Database, Brain, Star, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface Template {
  type: string;
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  icon: string;
  tags: string[];
  framework: string;
  language: string;
  features: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  popularity: number;
  downloads: number;
}

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Template) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  open,
  onOpenChange,
  onSelectTemplate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const templates: Template[] = [
    {
      type: 'web',
      name: 'react-typescript',
      displayName: 'React + TypeScript',
      description: 'Modern React application with TypeScript, Vite, and Tailwind CSS',
      longDescription: 'A comprehensive React starter template featuring TypeScript for type safety, Vite for fast development and building, Tailwind CSS for utility-first styling, and ESLint/Prettier for code quality. Perfect for building modern single-page applications with excellent developer experience.',
      icon: '⚛️',
      tags: ['Frontend', 'SPA', 'Modern', 'TypeScript'],
      framework: 'React',
      language: 'TypeScript',
      features: ['Hot Reload', 'TypeScript', 'Tailwind CSS', 'Vite', 'ESLint', 'Prettier'],
      difficulty: 'Beginner',
      estimatedTime: '30 minutes',
      popularity: 95,
      downloads: 15420
    },
    {
      type: 'web',
      name: 'nextjs-typescript',
      displayName: 'Next.js + TypeScript',
      description: 'Full-stack React framework with SSR, API routes, and TypeScript',
      longDescription: 'Next.js application template with TypeScript, featuring server-side rendering, API routes, image optimization, and built-in CSS support. Includes authentication setup, database integration examples, and deployment configuration for Vercel.',
      icon: '🔺',
      tags: ['Fullstack', 'SSR', 'API Routes', 'TypeScript'],
      framework: 'Next.js',
      language: 'TypeScript',
      features: ['Server-Side Rendering', 'API Routes', 'Image Optimization', 'TypeScript', 'Authentication Ready', 'SEO Optimized'],
      difficulty: 'Intermediate',
      estimatedTime: '45 minutes',
      popularity: 92,
      downloads: 12890
    },
    {
      type: 'backend',
      name: 'express-typescript',
      displayName: 'Express + TypeScript',
      description: 'RESTful API with Express.js, TypeScript, and comprehensive middleware',
      longDescription: 'Enterprise-ready Express.js API template with TypeScript, featuring JWT authentication, database integration, input validation, error handling, logging, and comprehensive testing setup. Includes Docker configuration and CI/CD pipeline examples.',
      icon: '🚀',
      tags: ['Backend', 'API', 'Express', 'TypeScript'],
      framework: 'Express',
      language: 'TypeScript',
      features: ['REST API', 'JWT Authentication', 'Database Integration', 'Input Validation', 'Error Handling', 'Testing'],
      difficulty: 'Intermediate',
      estimatedTime: '1 hour',
      popularity: 88,
      downloads: 9750
    },
    {
      type: 'backend',
      name: 'nestjs-typescript',
      displayName: 'NestJS + TypeScript',
      description: 'Enterprise-grade Node.js framework with decorators and dependency injection',
      longDescription: 'Scalable NestJS application with TypeScript, featuring dependency injection, decorators, guards, interceptors, pipes, and modular architecture. Includes GraphQL support, database integration with TypeORM, authentication, and comprehensive testing.',
      icon: '🐈',
      tags: ['Backend', 'Enterprise', 'Scalable', 'TypeScript'],
      framework: 'NestJS',
      language: 'TypeScript',
      features: ['Dependency Injection', 'Decorators', 'Guards', 'Interceptors', 'GraphQL', 'TypeORM'],
      difficulty: 'Advanced',
      estimatedTime: '2 hours',
      popularity: 85,
      downloads: 7320
    },
    {
      type: 'fullstack',
      name: 'mern-stack',
      displayName: 'MERN Stack',
      description: 'Full-stack application with MongoDB, Express, React, and Node.js',
      longDescription: 'Complete MERN stack application template featuring MongoDB for database, Express.js for backend API, React for frontend, and Node.js runtime. Includes user authentication, CRUD operations, state management with Redux, and deployment configuration.',
      icon: '🔧',
      tags: ['Fullstack', 'MERN', 'MongoDB', 'JavaScript'],
      framework: 'MERN',
      language: 'JavaScript',
      features: ['MongoDB', 'Express', 'React', 'Node.js', 'Redux', 'Authentication'],
      difficulty: 'Intermediate',
      estimatedTime: '2 hours',
      popularity: 90,
      downloads: 11240
    },
    {
      type: 'fullstack',
      name: 't3-stack',
      displayName: 'T3 Stack',
      description: 'Type-safe full-stack with Next.js, tRPC, Prisma, and TypeScript',
      longDescription: 'Modern full-stack TypeScript application using the T3 stack: Next.js for the framework, tRPC for type-safe APIs, Prisma for database ORM, and NextAuth for authentication. Features end-to-end type safety and excellent developer experience.',
      icon: '🏗️',
      tags: ['Fullstack', 'Type-safe', 'Modern', 'TypeScript'],
      framework: 'T3',
      language: 'TypeScript',
      features: ['tRPC', 'Prisma', 'NextAuth', 'TypeScript', 'Type Safety', 'Next.js'],
      difficulty: 'Advanced',
      estimatedTime: '3 hours',
      popularity: 87,
      downloads: 6890
    },
    {
      type: 'mobile',
      name: 'react-native',
      displayName: 'React Native',
      description: 'Cross-platform mobile app with React Native and Expo',
      longDescription: 'React Native mobile application template with Expo for easy development and deployment. Features navigation, state management, native device APIs, push notifications, and platform-specific optimizations for iOS and Android.',
      icon: '📱',
      tags: ['Mobile', 'Cross-platform', 'React', 'TypeScript'],
      framework: 'React Native',
      language: 'TypeScript',
      features: ['Cross-platform', 'Expo', 'Navigation', 'Native APIs', 'Push Notifications', 'Hot Reload'],
      difficulty: 'Intermediate',
      estimatedTime: '1.5 hours',
      popularity: 83,
      downloads: 8640
    },
    {
      type: 'ai',
      name: 'ai-chatbot',
      displayName: 'AI Chatbot',
      description: 'Intelligent chatbot with OpenAI integration and conversation management',
      longDescription: 'Advanced AI chatbot application with OpenAI GPT integration, conversation history, context management, real-time streaming responses, and customizable personality. Includes user authentication, chat persistence, and admin dashboard.',
      icon: '🤖',
      tags: ['AI', 'Chatbot', 'OpenAI', 'TypeScript'],
      framework: 'React',
      language: 'TypeScript',
      features: ['OpenAI Integration', 'Chat Interface', 'Context Management', 'Streaming', 'Chat History', 'Admin Dashboard'],
      difficulty: 'Advanced',
      estimatedTime: '2.5 hours',
      popularity: 91,
      downloads: 5240
    }
  ];

  const categories = [
    { value: 'all', label: 'All Categories', icon: Code },
    { value: 'web', label: 'Web Applications', icon: Globe },
    { value: 'mobile', label: 'Mobile Apps', icon: Smartphone },
    { value: 'backend', label: 'Backend APIs', icon: Database },
    { value: 'fullstack', label: 'Full-Stack', icon: Code },
    { value: 'ai', label: 'AI & ML', icon: Brain },
  ];

  const languages = ['all', 'TypeScript', 'JavaScript', 'Python', 'Go'];
  const difficulties = ['all', 'Beginner', 'Intermediate', 'Advanced'];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || template.type === selectedCategory;
    const matchesLanguage = selectedLanguage === 'all' || template.language === selectedLanguage;
    const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesLanguage && matchesDifficulty;
  });

  const popularTemplates = templates.sort((a, b) => b.popularity - a.popularity).slice(0, 4);
  const recentTemplates = templates.sort((a, b) => b.downloads - a.downloads).slice(0, 4);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Intermediate': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Advanced': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getTypeIcon = (type: string) => {
    const category = categories.find(cat => cat.value === type);
    return category ? category.icon : Code;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Star className="w-5 h-5" />
            <span>Template Gallery</span>
          </DialogTitle>
          <DialogDescription>
            Discover and explore professional templates to kickstart your next project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="browse" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="browse">Browse All</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="recent">Recently Updated</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="flex-1 overflow-hidden mt-4">
              <div className="flex flex-col h-full">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang} value={lang}>
                          {lang === 'all' ? 'All Languages' : lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map(diff => (
                        <SelectItem key={diff} value={diff}>
                          {diff === 'all' ? 'All Levels' : diff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Templates Grid */}
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {filteredTemplates.map((template) => (
                      <Card 
                        key={template.name}
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
                        onClick={() => setSelectedTemplate(template)}
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
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Download className="w-3 h-3" />
                              <span>{template.downloads.toLocaleString()}</span>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={getDifficultyColor(template.difficulty)}>
                              {template.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{template.estimatedTime}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {template.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="popular" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {popularTemplates.map((template) => (
                    <Card 
                      key={template.name}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{template.icon}</span>
                            <div>
                              <CardTitle className="text-base">{template.displayName}</CardTitle>
                              <CardDescription>{template.framework} • {template.language}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-sm font-medium">{template.popularity}</span>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={getDifficultyColor(template.difficulty)}>
                            {template.difficulty}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Download className="w-3 h-3" />
                            <span>{template.downloads.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recent" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentTemplates.map((template) => (
                    <Card 
                      key={template.name}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{template.icon}</span>
                            <div>
                              <CardTitle className="text-base">{template.displayName}</CardTitle>
                              <CardDescription>{template.framework} • {template.language}</CardDescription>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Recent
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={getDifficultyColor(template.difficulty)}>
                            {template.difficulty}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Download className="w-3 h-3" />
                            <span>{template.downloads.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {selectedTemplate && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{selectedTemplate.icon}</span>
                <div>
                  <h4 className="font-semibold">{selectedTemplate.displayName}</h4>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.framework} • {selectedTemplate.language}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={() => onSelectTemplate(selectedTemplate)}>
                  Use Template
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSelector;