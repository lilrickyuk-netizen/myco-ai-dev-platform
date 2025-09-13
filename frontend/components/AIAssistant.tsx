import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Code, 
  FileText, 
  Lightbulb, 
  Bug, 
  Settings,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    language?: string;
    fileContext?: string;
    suggestions?: string[];
    code?: boolean;
  };
}

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
  onCodeInsert?: (code: string) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  projectId,
  activeFile,
  onCodeInsert
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Hello! I\'m your AI coding assistant. I can help you write code, debug issues, explain concepts, and suggest improvements. How can I help you today?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickPrompts = [
    {
      icon: Code,
      title: 'Generate Code',
      prompt: 'Help me write code for: ',
      description: 'Generate code snippets'
    },
    {
      icon: Bug,
      title: 'Debug Issue',
      prompt: 'Help me debug this issue: ',
      description: 'Find and fix bugs'
    },
    {
      icon: FileText,
      title: 'Explain Code',
      prompt: 'Explain this code: ',
      description: 'Understand code functionality'
    },
    {
      icon: Lightbulb,
      title: 'Suggest Improvements',
      prompt: 'How can I improve this code: ',
      description: 'Optimize and enhance'
    },
  ];

  const addMessage = (content: string, type: Message['type'], metadata?: Message['metadata']) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      metadata,
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    addMessage(message, 'user');
    setInputMessage('');
    setIsLoading(true);

    try {
      // Prepare context
      const context = activeFile ? 
        `Current file: ${activeFile.name}\nPath: ${activeFile.path}\nContent:\n${activeFile.content || ''}` : 
        undefined;

      // Call AI service
      const response = await backend.ai.generate({
        prompt: message,
        context,
        projectId
      });

      // Add AI response
      addMessage(response.content, 'assistant', {
        code: response.content.includes('```'),
        fileContext: activeFile?.name,
      });

    } catch (error) {
      console.error('AI service error:', error);
      addMessage('Sorry, I encountered an error processing your request. Please try again.', 'assistant');
      
      toast({
        title: 'AI Service Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputMessage(prompt);
  };

  const handleCodeAction = async (action: 'copy' | 'insert', code: string) => {
    switch (action) {
      case 'copy':
        await navigator.clipboard.writeText(code);
        toast({
          title: 'Copied!',
          description: 'Code copied to clipboard',
        });
        break;
      case 'insert':
        if (onCodeInsert) {
          onCodeInsert(code);
          toast({
            title: 'Inserted!',
            description: 'Code inserted into editor',
          });
        }
        break;
    }
  };

  const extractCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push({
        language: match[1] || 'text',
        code: match[2],
      });
    }
    
    return matches;
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const codeBlocks = extractCodeBlocks(message.content);
    
    return (
      <div key={message.id} className={`mb-4 ${isUser ? 'ml-8' : 'mr-8'}`}>
        <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-500' : isSystem ? 'bg-yellow-500' : 'bg-purple-500'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : isSystem ? (
              <Sparkles className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
            <div className={`inline-block p-3 rounded-lg max-w-full ${
              isUser 
                ? 'bg-blue-500 text-white' 
                : isSystem 
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-gray-100 text-gray-800 border'
            }`}>
              {/* Render text content */}
              <div className="whitespace-pre-wrap">
                {message.content.replace(/```[\s\S]*?```/g, '[Code Block]')}
              </div>

              {/* Render code blocks */}
              {codeBlocks.map((block, index) => (
                <div key={index} className="mt-3 first:mt-0">
                  <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                    {/* Code header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                      <Badge variant="secondary" className="text-xs">
                        {block.language}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
                          onClick={() => handleCodeAction('copy', block.code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {onCodeInsert && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
                            onClick={() => handleCodeAction('insert', block.code)}
                          >
                            <Code className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Code content */}
                    <pre className="p-3 text-sm overflow-x-auto">
                      <code>{block.code}</code>
                    </pre>
                  </div>
                </div>
              ))}
            </div>

            {/* Message metadata */}
            <div className="mt-1 text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString()}
              {message.metadata?.fileContext && (
                <span className="ml-2">• {message.metadata.fileContext}</span>
              )}
            </div>

            {/* Message actions for AI responses */}
            {!isUser && !isSystem && (
              <div className="mt-2 flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500 hover:text-gray-700"
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  Good
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500 hover:text-gray-700"
                >
                  <ThumbsDown className="w-3 h-3 mr-1" />
                  Poor
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-card/50 border-l">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-sm">AI Assistant</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                Model: GPT-4
              </DropdownMenuItem>
              <DropdownMenuItem>
                Temperature: 0.7
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Clear Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-b p-3">
        <div className="grid grid-cols-2 gap-2">
          {quickPrompts.map((prompt, index) => {
            const Icon = prompt.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-auto p-2 flex flex-col items-center text-center"
                onClick={() => handleQuickPrompt(prompt.prompt)}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-xs">{prompt.title}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div>
          {messages.map(renderMessage)}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-4 mr-8">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="inline-block p-3 rounded-lg bg-gray-100 border">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-gray-600"></div>
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex space-x-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputMessage);
              }
            }}
            placeholder="Ask me anything about your code..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {activeFile && (
          <div className="mt-2 text-xs text-gray-500">
            Context: {activeFile.name}
          </div>
        )}
      </div>
    </div>
  );
};

export { AIAssistant };
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI coding assistant. I can help you write code, debug issues, explain concepts, and provide suggestions. What would you like to work on?",
      timestamp: new Date(),
      type: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const backend = useBackend();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      type: "text"
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const context = {
        projectId,
        currentFile: currentFile ? {
          path: currentFile.path,
          name: currentFile.name,
          type: currentFile.type
        } : null,
        recentMessages: messages.slice(-5).map(m => ({
          role: m.role,
          content: m.content
        }))
      };

      const response = await backend.ai.chat({
        message: userMessage.content,
        context
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        type: response.type || "text"
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If the response contains code and user wants to apply it
      if (response.type === "code" && response.code) {
        // Auto-apply code if it's a direct code generation request
        if (userMessage.content.toLowerCase().includes("generate") || 
            userMessage.content.toLowerCase().includes("write") ||
            userMessage.content.toLowerCase().includes("create")) {
          onCodeGenerated(response.code);
        }
      }

    } catch (err) {
      console.error("Failed to send message:", err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
        type: "text"
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertCodeSuggestion = (code: string) => {
    onCodeGenerated(code);
    toast({
      title: "Code Applied",
      description: "The code has been inserted into the editor."
    });
  };

  const quickActions = [
    {
      icon: Code,
      label: "Explain this code",
      prompt: "Explain the code in the current file"
    },
    {
      icon: Lightbulb,
      label: "Suggest improvements",
      prompt: "Suggest improvements for the code in the current file"
    },
    {
      icon: Bot,
      label: "Debug help",
      prompt: "Help me debug issues in this code"
    }
  ];

  const handleQuickAction = (prompt: string) => {
    if (!currentFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to use this action.",
        variant: "destructive"
      });
      return;
    }
    setInput(prompt);
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <CardHeader className="border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI Assistant
        </CardTitle>
      </CardHeader>

      {/* Quick Actions */}
      {currentFile && (
        <div className="p-3 border-b">
          <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
          <div className="grid grid-cols-1 gap-1">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction(action.prompt)}
                className="justify-start gap-2 h-8"
              >
                <action.icon className="h-3 w-3" />
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted"
                  }`}
                >
                  {message.type === "code" ? (
                    <div className="space-y-2">
                      <pre className="text-sm overflow-x-auto bg-background p-2 rounded border">
                        <code>{message.content}</code>
                      </pre>
                      {message.role === "assistant" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => insertCodeSuggestion(message.content)}
                          className="gap-2"
                        >
                          <Code className="h-3 w-3" />
                          Apply Code
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your code..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {currentFile && (
          <p className="text-xs text-muted-foreground mt-2">
            Context: {currentFile.name}
          </p>
        )}
      </div>
    </div>
  );
}
