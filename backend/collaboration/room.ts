import { api, StreamInOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

interface CollaborationMessage {
  type: 'cursor' | 'selection' | 'edit' | 'chat' | 'presence';
  userId: string;
  userName: string;
  projectId: string;
  data: any;
  timestamp: Date;
}

const collaborationRooms: Map<string, Set<StreamInOut<CollaborationMessage, CollaborationMessage>>> = new Map();

// Real-time collaboration stream for a project.
export const collaborate = api.streamInOut<CollaborationMessage, CollaborationMessage>(
  { auth: true, expose: true, path: "/collaboration/room" },
  async (stream) => {
    const auth = getAuthData()!;
    let currentProjectId: string | null = null;

    try {
      for await (const message of stream) {
        // Validate message
        if (!message.projectId) continue;
        
        // Join/switch project room
        if (currentProjectId !== message.projectId) {
          // Leave current room
          if (currentProjectId) {
            const currentRoom = collaborationRooms.get(currentProjectId);
            if (currentRoom) {
              currentRoom.delete(stream);
              if (currentRoom.size === 0) {
                collaborationRooms.delete(currentProjectId);
              }
            }
          }
          
          // Join new room
          currentProjectId = message.projectId;
          if (!collaborationRooms.has(currentProjectId)) {
            collaborationRooms.set(currentProjectId, new Set());
          }
          collaborationRooms.get(currentProjectId)!.add(stream);
          
          // Send presence update
          const presenceMessage: CollaborationMessage = {
            type: 'presence',
            userId: auth.userID,
            userName: `${auth.firstName || ''} ${auth.lastName || ''}`.trim() || auth.email || 'Anonymous',
            projectId: currentProjectId,
            data: { action: 'joined' },
            timestamp: new Date(),
          };
          
          broadcastToRoom(currentProjectId, presenceMessage, stream);
        }
        
        // Add user info to message
        const enrichedMessage: CollaborationMessage = {
          ...message,
          userId: auth.userID,
          userName: `${auth.firstName || ''} ${auth.lastName || ''}`.trim() || auth.email || 'Anonymous',
          timestamp: new Date(),
        };
        
        // Broadcast to room
        broadcastToRoom(currentProjectId, enrichedMessage, stream);
      }
    } finally {
      // Clean up when user disconnects
      if (currentProjectId) {
        const room = collaborationRooms.get(currentProjectId);
        if (room) {
          room.delete(stream);
          
          // Send presence update
          const presenceMessage: CollaborationMessage = {
            type: 'presence',
            userId: auth.userID,
            userName: `${auth.firstName || ''} ${auth.lastName || ''}`.trim() || auth.email || 'Anonymous',
            projectId: currentProjectId,
            data: { action: 'left' },
            timestamp: new Date(),
          };
          
          broadcastToRoom(currentProjectId, presenceMessage);
          
          if (room.size === 0) {
            collaborationRooms.delete(currentProjectId);
          }
        }
      }
    }
  }
);

function broadcastToRoom(
  projectId: string, 
  message: CollaborationMessage, 
  excludeStream?: StreamInOut<CollaborationMessage, CollaborationMessage>
) {
  const room = collaborationRooms.get(projectId);
  if (!room) return;
  
  for (const clientStream of room) {
    if (clientStream === excludeStream) continue;
    
    try {
      clientStream.send(message);
    } catch (err) {
      // Remove disconnected clients
      room.delete(clientStream);
    }
  }
}
