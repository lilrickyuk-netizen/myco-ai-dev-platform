import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Code, FileText, Lightbulb, Bot, User, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';

interface File {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirectory: boolean;
}

interface AIAssistantProps {
  projectId: string;
  activeFile?: File | null;
  onCodeInsert: (code: string) => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string;
  suggestions?: string[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  projectId, 
  activeFile, 
  onCodeInsert 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI coding assistant. I can help you generate code, explain concepts, debug issues, and provide suggestions. How can I assist you today?',
      timestamp: new Date(),
      suggestions: [
        'Generate a React component',
        'Explain this code',
        'Help debug an issue',
        'Create unit tests'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  const backend = useBackend();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context
      const context = activeFile ? `Current file: ${activeFile.name}\n\nCode:\n${activeFile.content || ''}` : '';
      
      const response = await backend.ai.generate({
        prompt: input,
        context,
        projectId,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const generateCode = async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await backend.ai.generateCode({
        description: prompt,
        language: 'typescript',
        framework: 'react',
        projectId,
      });

      if (response.files.length > 0) {
        const codeContent = response.files[0].content;
        const assistantMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `I've generated the requested code:\n\n${response.instructions}`,
          code: codeContent,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "Error",
        description: "Failed to generate code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const explainCode = async () => {
    if (!activeFile?.content) {
      toast({
        title: "No Code",
        description: "Please select a file with code to explain",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await backend.ai.explainCode({
        code: activeFile.content,
        language: 'typescript',
      });

      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: response.explanation,
        suggestions: response.suggestions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error explaining code:', error);
      toast({
        title: "Error",
        description: "Failed to explain code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const debugCode = async () => {
    if (!activeFile?.content) {
      toast({
        title: "No Code",
        description: "Please select a file with code to debug",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await backend.ai.debug({
        code: activeFile.content,
        language: 'typescript',
      });

      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: response.explanation,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error debugging code:', error);
      toast({
        title: "Error",
        description: "Failed to debug code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Generate Component',
      description: 'Create a new React component',
      icon: Code,
      action: () => generateCode('Create a new React functional component with TypeScript'),
    },
    {
      title: 'Explain Code',
      description: 'Explain the current file',
      icon: FileText,
      action: explainCode,
      disabled: !activeFile?.content,
    },
    {
      title: 'Debug Issues',
      description: 'Find and fix problems',
      icon: Lightbulb,
      action: debugCode,
      disabled: !activeFile?.content,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-card/50 p-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-3 mt-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-3 mx-3">
          {/* Messages */}
          <ScrollArea className="flex-1 mb-4" ref={scrollRef}>
            <div className="space-y-4 p-2">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      
                      <div className={`rounded-lg p-3 ${
                        message.type === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {message.code && (
                          <div className="mt-3 p-3 bg-gray-900 rounded text-green-400 text-xs font-mono">
                            <div className="flex items-center justify-between mb-2">
                              <span>Generated Code</span>
                              <div className="flex space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                                  onClick={() => navigator.clipboard.writeText(message.code!)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                                  onClick={() => onCodeInsert(message.code!)}
                                >
                                  <Code className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <pre className="whitespace-pre-wrap">{message.code}</pre>
                          </div>
                        )}
                        
                        {message.suggestions && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs opacity-75">Suggestions:</p>
                            {message.suggestions.map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="ghost"
                                size="sm"
                                className="h-auto p-2 text-xs hover:bg-background/20 w-full justify-start"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs opacity-50 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="space-y-2">
            {activeFile && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span>Context: {activeFile.name}</span>
              </div>
            )}
            
            <div className="flex space-x-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your code..."
                className="flex-1 min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 mt-3 mx-3">
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Card key={index} className={`cursor-pointer transition-colors ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'}`}>
                <CardContent className="p-4" onClick={action.disabled ? undefined : action.action}>
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <action.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{action.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Code Templates */}
            <div className="mt-6">
              <h4 className="font-medium text-sm mb-3">Code Templates</h4>
              <div className="space-y-2">
                {[
                  'React functional component',
                  'Express API endpoint',
                  'Database model',
                  'Unit test',
                  'Custom hook',
                ].map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => generateCode(`Generate ${template}`)}
                  >
                    <Code className="w-3 h-3 mr-2" />
                    {template}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAssistant;