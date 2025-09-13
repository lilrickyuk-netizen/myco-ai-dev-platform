import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Loader, Code, FileText, Bug, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useBackend } from '../hooks/useBackend';
import { useToast } from '@/components/ui/use-toast';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentFile?: string;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'code' | 'explanation' | 'suggestion';
}

const QUICK_ACTIONS = [
  { icon: Code, label: 'Generate Code', prompt: 'Help me generate code for' },
  { icon: Bug, label: 'Fix Bug', prompt: 'Help me debug this issue:' },
  { icon: FileText, label: 'Explain Code', prompt: 'Please explain how this code works:' },
  { icon: Lightbulb, label: 'Optimize', prompt: 'How can I optimize this code:' },
];

export default function AIAssistant({ isOpen, onClose, projectId, currentFile, className }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI coding assistant. I can help you with code generation, debugging, explanations, and optimization. What would you like to work on?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const backend = useBackend();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call AI service
      const response = await backend.ai.generate({
        prompt: input.trim(),
        projectId,
        context: {
          currentFile,
          previousMessages: messages.slice(-5), // Send last 5 messages for context
        }
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        type: response.type || 'explanation',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI request failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt + ' ');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-50 px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
          <Badge variant="secondary" className="text-xs">
            GPT-4
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="outline"
              onClick={() => handleQuickAction(action.prompt)}
              className="justify-start text-xs h-8"
            >
              <action.icon className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[85%] p-3 ${
              message.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-50 text-gray-900'
            }`}>
              <div className="text-sm whitespace-pre-wrap">
                {message.content}
              </div>
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString()}
                {message.type && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {message.type}
                  </Badge>
                )}
              </div>
            </Card>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your code..."
            className="flex-1 min-h-[80px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}