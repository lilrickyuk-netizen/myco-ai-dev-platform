import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, X, Circle, Video, Share2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useBackend } from '../hooks/useBackend';

interface CollaborationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  className?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  role: 'owner' | 'collaborator' | 'viewer';
  cursor?: {
    file: string;
    line: number;
    column: number;
  };
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'message' | 'system';
}

export default function CollaborationPanel({ isOpen, onClose, projectId, className }: CollaborationPanelProps) {
  const [activeUsers, setActiveUsers] = useState<User[]>([
    {
      id: '1',
      name: 'You',
      email: 'user@example.com',
      status: 'online',
      role: 'owner',
    },
    {
      id: '2',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      status: 'online',
      role: 'collaborator',
      cursor: {
        file: 'src/App.tsx',
        line: 45,
        column: 12,
      },
    },
    {
      id: '3',
      name: 'Mike Johnson',
      email: 'mike@example.com',
      status: 'away',
      role: 'viewer',
    },
  ]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      userId: 'system',
      userName: 'System',
      content: 'Sarah Chen joined the project',
      timestamp: new Date(Date.now() - 300000),
      type: 'system',
    },
    {
      id: '2',
      userId: '2',
      userName: 'Sarah Chen',
      content: 'Hey! Working on the authentication flow',
      timestamp: new Date(Date.now() - 240000),
      type: 'message',
    },
    {
      id: '3',
      userId: '1',
      userName: 'You',
      content: 'Great! I\'m updating the UI components',
      timestamp: new Date(Date.now() - 180000),
      type: 'message',
    },
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'chat'>('users');
  const backend = useBackend();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'away': return 'text-yellow-500';
      case 'offline': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'collaborator': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: '1',
      userName: 'You',
      content: newMessage.trim(),
      timestamp: new Date(),
      type: 'message',
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const initiateVideoCall = () => {
    // TODO: Implement video call functionality
    console.log('Starting video call...');
  };

  const shareProject = () => {
    // TODO: Implement project sharing
    console.log('Sharing project...');
  };

  if (!isOpen) return null;

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-green-50 px-4 py-3 border-b border-green-200">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Collaboration</h3>
          <Badge variant="secondary" className="text-xs">
            {activeUsers.filter(u => u.status === 'online').length} online
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={initiateVideoCall}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
            title="Start video call"
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={shareProject}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
            title="Share project"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Users ({activeUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'users' && (
          <div className="p-4 space-y-3">
            {activeUsers.map((user) => (
              <Card key={user.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <Circle
                      className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(user.status)} fill-current`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {user.name}
                      </span>
                      {user.role === 'owner' && (
                        <Crown className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${getRoleColor(user.role)}`}>
                        {user.role}
                      </Badge>
                      <span className="text-xs text-gray-500 capitalize">
                        {user.status}
                      </span>
                    </div>
                    {user.cursor && (
                      <div className="text-xs text-gray-500 mt-1">
                        Editing: {user.cursor.file}:{user.cursor.line}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((message) => (
                <div key={message.id}>
                  {message.type === 'system' ? (
                    <div className="text-center text-xs text-gray-500 py-1">
                      {message.content}
                    </div>
                  ) : (
                    <div className={`flex ${message.userId === '1' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg p-2 ${
                        message.userId === '1'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        {message.userId !== '1' && (
                          <div className="text-xs font-medium mb-1">
                            {message.userName}
                          </div>
                        )}
                        <div className="text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.userId === '1' ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="sm"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}