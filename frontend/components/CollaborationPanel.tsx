import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Send, 
  MessageSquare, 
  UserPlus, 
  Settings, 
  Video, 
  Mic, 
  MicOff,
  VideoOff,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBackend } from '../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';
import { useToast } from '@/components/ui/use-toast';

interface CollaborationPanelProps {
  projectId: string;
}

interface Collaborator {
  userId: string;
  userName: string;
  userColor: string;
  isOnline: boolean;
  lastSeen?: Date;
  cursor?: {
    line: number;
    column: number;
    file?: string;
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

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ projectId }) => {
  const { user } = useUser();
  const backend = useBackend();
  const { toast } = useToast();
  
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);

  useEffect(() => {
    // Initialize collaboration connection
    connectToCollaboration();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [projectId]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const connectToCollaboration = async () => {
    try {
      // This would connect to the collaboration websocket
      // For now, we'll simulate the connection
      setIsConnected(true);
      
      // Add welcome message
      setChatMessages([{
        id: '1',
        userId: 'system',
        userName: 'System',
        content: 'Welcome to the collaboration session! You can chat with other team members here.',
        timestamp: new Date(),
        type: 'system'
      }]);

      // Simulate some collaborators
      setCollaborators([
        {
          userId: user?.id || 'current-user',
          userName: user?.firstName || 'You',
          userColor: '#3b82f6',
          isOnline: true,
        }
      ]);

      toast({
        title: "Connected",
        description: "Joined collaboration session",
      });
    } catch (error) {
      console.error('Error connecting to collaboration:', error);
      toast({
        title: "Connection Error",
        description: "Failed to join collaboration session",
        variant: "destructive",
      });
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !isConnected) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user?.id || 'anonymous',
      userName: user?.firstName || user?.emailAddresses[0]?.emailAddress || 'Anonymous',
      content: chatInput,
      timestamp: new Date(),
      type: 'message'
    };

    setChatMessages(prev => [...prev, message]);
    setChatInput('');

    // In a real implementation, this would send through websocket
    // wsRef.current?.send(JSON.stringify({ type: 'chat', data: message }));
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const inviteCollaborator = () => {
    // This would open an invite dialog
    toast({
      title: "Invite Link",
      description: "Invite link copied to clipboard (feature coming soon)",
    });
  };

  const startVoiceCall = () => {
    toast({
      title: "Voice Call",
      description: "Voice calling feature coming soon",
    });
  };

  const startVideoCall = () => {
    toast({
      title: "Video Call",
      description: "Video calling feature coming soon",
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-sm">Collaboration</h3>
            <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={startVoiceCall}
            >
              <Mic className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={startVideoCall}
            >
              <Video className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-3 mt-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="users">Users ({collaborators.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-3 mx-3">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 mb-4" ref={chatScrollRef}>
            <div className="space-y-3 p-2">
              {chatMessages.map((message) => (
                <div key={message.id} className="space-y-1">
                  {message.type === 'system' ? (
                    <div className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {message.content}
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {getInitials(message.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{message.userName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="flex space-x-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Type a message..."
              className="flex-1"
              disabled={!isConnected}
            />
            <Button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || !isConnected}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="users" className="flex-1 mt-3 mx-3">
          <div className="space-y-3">
            {/* Invite Button */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={inviteCollaborator}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Collaborators
            </Button>

            {/* Collaborators List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Active Users ({collaborators.filter(c => c.isOnline).length})
              </h4>
              
              {collaborators.map((collaborator) => (
                <Card key={collaborator.userId} className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback 
                          className="text-xs"
                          style={{ backgroundColor: collaborator.userColor + '20', color: collaborator.userColor }}
                        >
                          {getInitials(collaborator.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                          collaborator.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium truncate">
                          {collaborator.userName}
                        </span>
                        {collaborator.userId === user?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: collaborator.userColor }}
                        />
                        <span>
                          {collaborator.isOnline ? 'Online' : 'Offline'}
                        </span>
                        {collaborator.cursor && (
                          <span>• Line {collaborator.cursor.line}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Collaboration Features */}
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Quick Actions</h4>
              
              <Button variant="outline" size="sm" className="w-full justify-start">
                <MessageSquare className="w-4 h-4 mr-2" />
                Share Screen
              </Button>
              
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Collaboration Settings
              </Button>
            </div>

            {/* Connection Status */}
            <Card className="mt-4">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Connection Status</span>
                  <Badge variant={isConnected ? "default" : "destructive"}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Session ID</span>
                  <code className="text-xs bg-muted px-1 rounded">
                    {projectId.slice(0, 8)}...
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CollaborationPanel;