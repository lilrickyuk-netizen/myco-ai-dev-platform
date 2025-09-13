import { api, StreamInOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { projectsDB } from "../projects/db";

export interface JoinRoomParams {
  projectId: string;
}

export interface CollaborationMessage {
  type: 'cursor' | 'edit' | 'selection' | 'user_join' | 'user_leave' | 'chat';
  userId: string;
  userName: string;
  userColor: string;
  data: any;
  timestamp: Date;
}

// Store active collaboration streams per project
const collaborationRooms: Map<string, Set<StreamInOut<CollaborationMessage, CollaborationMessage>>> = new Map();

// Real-time collaboration room for a project.
export const joinRoom = api.streamInOut<JoinRoomParams, CollaborationMessage, CollaborationMessage>(
  { auth: true, expose: true, path: "/collaboration/rooms/:projectId" },
  async ({ projectId }, stream) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow`
      SELECT id, name FROM projects 
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      return; // Close stream if no access
    }

    // Get or create room
    if (!collaborationRooms.has(projectId)) {
      collaborationRooms.set(projectId, new Set());
    }
    const room = collaborationRooms.get(projectId)!;

    // Add stream to room
    room.add(stream);

    // Generate user color
    const userColor = generateUserColor(auth.userID);
    const userName = auth.firstName || auth.email?.split('@')[0] || 'Anonymous';

    // Broadcast user join
    await broadcastToRoom(projectId, {
      type: 'user_join',
      userId: auth.userID,
      userName,
      userColor,
      data: { userName, userColor },
      timestamp: new Date(),
    }, stream);

    try {
      // Listen for messages from this user
      for await (const message of stream) {
        // Add user info to message
        const enrichedMessage = {
          ...message,
          userId: auth.userID,
          userName,
          userColor,
          timestamp: new Date(),
        };

        // Broadcast to all other users in the room
        await broadcastToRoom(projectId, enrichedMessage, stream);
      }
    } finally {
      // Clean up when user disconnects
      room.delete(stream);
      
      // Broadcast user leave
      await broadcastToRoom(projectId, {
        type: 'user_leave',
        userId: auth.userID,
        userName,
        userColor,
        data: { userName },
        timestamp: new Date(),
      }, stream);

      // Remove room if empty
      if (room.size === 0) {
        collaborationRooms.delete(projectId);
      }
    }
  }
);

// Helper function to broadcast message to all users in a room except sender
async function broadcastToRoom(
  projectId: string, 
  message: CollaborationMessage, 
  sender?: StreamInOut<CollaborationMessage, CollaborationMessage>
) {
  const room = collaborationRooms.get(projectId);
  if (!room) return;

  const deadStreams: Set<StreamInOut<CollaborationMessage, CollaborationMessage>> = new Set();

  for (const stream of room) {
    if (stream === sender) continue; // Don't send back to sender

    try {
      await stream.send(message);
    } catch (error) {
      // Mark dead streams for cleanup
      deadStreams.add(stream);
    }
  }

  // Clean up dead streams
  for (const deadStream of deadStreams) {
    room.delete(deadStream);
  }
}

// Generate a consistent color for a user
function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#FF8C94', '#A8E6CF', '#FFD93D', '#6C5CE7',
    '#00B894', '#E17055', '#0984e3', '#6C5CE7', '#A29BFE'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}