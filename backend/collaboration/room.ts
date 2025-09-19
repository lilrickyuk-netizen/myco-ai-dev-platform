import { api, StreamInOut, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { logger } from "../middleware/logging";

// Reference the projects database
const projectsDB = SQLDatabase.named("projects");

export interface JoinRoomParams {
  projectId: string;
}

export interface CollaborationMessage {
  type: 'cursor' | 'edit' | 'selection' | 'user_join' | 'user_leave' | 'chat' | 'file_lock' | 'file_unlock' | 'typing';
  userId: string;
  userName: string;
  userColor: string;
  data: any;
  timestamp: Date;
  messageId?: string;
}

export interface RoomUser {
  userId: string;
  userName: string;
  userColor: string;
  joinedAt: Date;
  lastActivity: Date;
  stream: StreamInOut<CollaborationMessage, CollaborationMessage>;
}

export interface RoomInfo {
  projectId: string;
  projectName: string;
  activeUsers: Array<{
    userId: string;
    userName: string;
    userColor: string;
    joinedAt: Date;
    lastActivity: Date;
  }>;
  createdAt: Date;
}

// Store active collaboration rooms
const collaborationRooms: Map<string, Map<string, RoomUser>> = new Map();

// Real-time collaboration room for a project
export const joinRoom = api.streamInOut<JoinRoomParams, CollaborationMessage, CollaborationMessage>(
  { auth: true, expose: true, path: "/collaboration/rooms/:projectId" },
  async ({ projectId }, stream) => {
    const auth = getAuthData()!;
    const userId = auth.userID;
    const requestId = generateMessageId();

    logger.info('User attempting to join collaboration room', { 
      requestId, 
      userId, 
      projectId 
    });

    try {
      // Verify user has access to the project (owner or collaborator)
      const project = await projectsDB.queryRow<{ id: string; name: string }>`
        SELECT DISTINCT p.id, p.name
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = ${projectId}
        AND (
          p.user_id = ${userId} 
          OR (pc.user_id = ${userId} AND pc.joined_at IS NOT NULL)
        )
      `;

      if (!project) {
        logger.warn('User denied access to collaboration room', { 
          requestId, 
          userId, 
          projectId 
        });
        return; // Close stream if no access
      }

      // Get or create room
      if (!collaborationRooms.has(projectId)) {
        collaborationRooms.set(projectId, new Map());
        logger.info('Created new collaboration room', { projectId, projectName: project.name });
      }
      const room = collaborationRooms.get(projectId)!;

      // Generate user info
      const userColor = generateUserColor(userId);
      const userName = auth.firstName || auth.email?.split('@')[0] || 'Anonymous';
      const joinedAt = new Date();

      // Add user to room
      const roomUser: RoomUser = {
        userId,
        userName,
        userColor,
        joinedAt,
        lastActivity: joinedAt,
        stream
      };

      room.set(userId, roomUser);

      logger.info('User joined collaboration room', { 
        requestId, 
        userId, 
        userName, 
        projectId, 
        activeUsers: room.size 
      });

      // Broadcast user join to other users
      await broadcastToRoom(projectId, {
        type: 'user_join',
        userId,
        userName,
        userColor,
        data: { 
          userName, 
          userColor, 
          joinedAt,
          activeUsers: Array.from(room.values()).map(u => ({
            userId: u.userId,
            userName: u.userName,
            userColor: u.userColor,
            joinedAt: u.joinedAt,
            lastActivity: u.lastActivity
          }))
        },
        timestamp: joinedAt,
        messageId: generateMessageId()
      }, userId);

      try {
        // Listen for messages from this user
        for await (const message of stream) {
          const now = new Date();
          
          // Update user's last activity
          const user = room.get(userId);
          if (user) {
            user.lastActivity = now;
          }

          // Validate and enrich message
          const enrichedMessage: CollaborationMessage = {
            ...message,
            userId,
            userName,
            userColor,
            timestamp: now,
            messageId: message.messageId || generateMessageId()
          };

          // Log certain message types
          if (message.type === 'chat' || message.type === 'file_lock' || message.type === 'file_unlock') {
            logger.info('Collaboration message', { 
              requestId, 
              userId, 
              projectId, 
              messageType: message.type,
              messageId: enrichedMessage.messageId
            });
          }

          // Broadcast to all other users in the room
          await broadcastToRoom(projectId, enrichedMessage, userId);
        }
      } catch (error) {
        logger.error('Error in collaboration stream', error as Error, { 
          requestId, 
          userId, 
          projectId 
        });
      } finally {
        // Clean up when user disconnects
        room.delete(userId);
        
        logger.info('User left collaboration room', { 
          requestId, 
          userId, 
          userName, 
          projectId, 
          activeUsers: room.size 
        });
        
        // Broadcast user leave
        await broadcastToRoom(projectId, {
          type: 'user_leave',
          userId,
          userName,
          userColor,
          data: { 
            userName,
            activeUsers: Array.from(room.values()).map(u => ({
              userId: u.userId,
              userName: u.userName,
              userColor: u.userColor,
              joinedAt: u.joinedAt,
              lastActivity: u.lastActivity
            }))
          },
          timestamp: new Date(),
          messageId: generateMessageId()
        }, userId);

        // Remove room if empty
        if (room.size === 0) {
          collaborationRooms.delete(projectId);
          logger.info('Removed empty collaboration room', { projectId });
        }
      }
    } catch (error) {
      logger.error('Failed to join collaboration room', error as Error, { 
        requestId, 
        userId, 
        projectId 
      });
    }
  }
);

// Get active collaboration rooms
export const getRooms = api<void, RoomInfo[]>(
  { auth: true, expose: true, method: "GET", path: "/collaboration/rooms" },
  async () => {
    const auth = getAuthData()!;
    const rooms: RoomInfo[] = [];

    for (const [projectId, room] of collaborationRooms) {
      // Check if user has access to this project
      const project = await projectsDB.queryRow<{ name: string }>`
        SELECT DISTINCT p.name
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = ${projectId}
        AND (
          p.user_id = ${auth.userID} 
          OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
        )
      `;

      if (project && room.size > 0) {
        const users = Array.from(room.values());
        rooms.push({
          projectId,
          projectName: project.name,
          activeUsers: users.map(u => ({
            userId: u.userId,
            userName: u.userName,
            userColor: u.userColor,
            joinedAt: u.joinedAt,
            lastActivity: u.lastActivity
          })),
          createdAt: users.reduce((earliest, u) => 
            u.joinedAt < earliest ? u.joinedAt : earliest, 
            new Date()
          )
        });
      }
    }

    return rooms;
  }
);

// Get room info for a specific project
export const getRoomInfo = api<{ projectId: string }, RoomInfo | null>(
  { auth: true, expose: true, method: "GET", path: "/collaboration/rooms/:projectId/info" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify user has access to the project
    const project = await projectsDB.queryRow<{ name: string }>`
      SELECT DISTINCT p.name
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE p.id = ${projectId}
      AND (
        p.user_id = ${auth.userID} 
        OR (pc.user_id = ${auth.userID} AND pc.joined_at IS NOT NULL)
      )
    `;

    if (!project) {
      throw APIError.notFound("Project not found or access denied");
    }

    const room = collaborationRooms.get(projectId);
    if (!room || room.size === 0) {
      return null;
    }

    const users = Array.from(room.values());
    return {
      projectId,
      projectName: project.name,
      activeUsers: users.map(u => ({
        userId: u.userId,
        userName: u.userName,
        userColor: u.userColor,
        joinedAt: u.joinedAt,
        lastActivity: u.lastActivity
      })),
      createdAt: users.reduce((earliest, u) => 
        u.joinedAt < earliest ? u.joinedAt : earliest, 
        new Date()
      )
    };
  }
);

// Broadcast a message to a room (admin only)
export const broadcastMessage = api<{
  projectId: string;
  message: Omit<CollaborationMessage, 'userId' | 'userName' | 'userColor' | 'timestamp' | 'messageId'>;
}, { success: boolean; deliveredTo: number }>(
  { auth: true, expose: true, method: "POST", path: "/collaboration/rooms/:projectId/broadcast" },
  async ({ projectId, message }) => {
    const auth = getAuthData()!;

    // Verify user is project owner
    const project = await projectsDB.queryRow`
      SELECT id FROM projects 
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("Project not found or insufficient permissions");
    }

    const enrichedMessage: CollaborationMessage = {
      ...message,
      userId: 'system',
      userName: 'System',
      userColor: '#000000',
      timestamp: new Date(),
      messageId: generateMessageId()
    };

    const room = collaborationRooms.get(projectId);
    const deliveredTo = room ? room.size : 0;

    await broadcastToRoom(projectId, enrichedMessage);

    logger.info('System message broadcast to collaboration room', { 
      projectId, 
      messageType: message.type,
      deliveredTo 
    });

    return { success: true, deliveredTo };
  }
);

// Helper function to broadcast message to all users in a room except sender
async function broadcastToRoom(
  projectId: string, 
  message: CollaborationMessage, 
  excludeUserId?: string
): Promise<void> {
  const room = collaborationRooms.get(projectId);
  if (!room) return;

  const deadStreams: string[] = [];
  let delivered = 0;

  for (const [userId, roomUser] of room) {
    if (userId === excludeUserId) continue; // Don't send back to sender

    try {
      await roomUser.stream.send(message);
      delivered++;
    } catch (error) {
      // Mark dead streams for cleanup
      deadStreams.push(userId);
      logger.warn('Failed to deliver message to user', error as Error, { 
        projectId, 
        userId, 
        messageType: message.type 
      });
    }
  }

  // Clean up dead streams
  for (const deadUserId of deadStreams) {
    room.delete(deadUserId);
  }

  if (deadStreams.length > 0) {
    logger.info('Cleaned up dead collaboration streams', { 
      projectId, 
      cleanedUp: deadStreams.length,
      remaining: room.size 
    });
  }
}

// Generate a consistent color for a user
function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#FF8C94', '#A8E6CF', '#FFD93D', '#6C5CE7',
    '#00B894', '#E17055', '#0984e3', '#6C5CE7', '#A29BFE',
    '#FD79A8', '#FDCB6E', '#55A3FF', '#FF7675', '#74B9FF'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Generate unique message ID
function generateMessageId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Cleanup inactive users periodically
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

  for (const [projectId, room] of collaborationRooms) {
    const inactiveUsers: string[] = [];
    
    for (const [userId, user] of room) {
      if (now.getTime() - user.lastActivity.getTime() > inactiveThreshold) {
        inactiveUsers.push(userId);
      }
    }

    for (const userId of inactiveUsers) {
      room.delete(userId);
      logger.info('Removed inactive user from collaboration room', { 
        projectId, 
        userId,
        inactiveDuration: now.getTime() - room.get(userId)?.lastActivity.getTime()
      });
    }

    if (room.size === 0) {
      collaborationRooms.delete(projectId);
    }
  }
}, 10 * 60 * 1000); // Run every 10 minutes