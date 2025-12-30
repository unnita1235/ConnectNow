/**
 * Socket.IO Server
 * =============================================================================
 * Standalone Socket.IO server for real-time messaging.
 * Can be deployed separately on Railway/Render for horizontal scaling.
 *
 * Run with: npx tsx server/socket.ts
 * Or: npm run socket:dev
 */

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient, UserStatus, MessageType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketUser,
  SocketMessage,
  SocketDirectMessage,
} from '../src/lib/socket/types';
import {
  getChannelRoom,
  getUserRoom,
} from '../src/lib/socket/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.SOCKET_PORT || '3001', 10);
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

// Typing indicator timeout (5 seconds)
const TYPING_TIMEOUT = 5000;

// Connection idle timeout (30 minutes)
const IDLE_TIMEOUT = 30 * 60 * 1000;

// =============================================================================
// INITIALIZE
// =============================================================================

const prisma = new PrismaClient();
const httpServer = createServer();

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Typing indicators tracking: channelId -> { userId -> timeout }
const typingUsers = new Map<string, Map<string, NodeJS.Timeout>>();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Verify JWT token and extract user data
 */
async function verifyToken(token: string): Promise<SocketUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user || !user.isActive || user.isBanned) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Check if user is a member of a channel
 */
async function isChannelMember(userId: string, channelId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true, isPrivate: true },
  });

  if (!channel) return false;

  if (channel.isPrivate) {
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    return !!member;
  }

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
  });
  return !!workspaceMember;
}

/**
 * Format message for socket event
 */
function formatMessage(message: any): SocketMessage {
  const reactionMap = new Map<string, { emoji: string; count: number; users: string[] }>();

  for (const reaction of message.reactions || []) {
    const existing = reactionMap.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      users: [],
    };
    existing.count++;
    existing.users.push(reaction.user?.displayName || reaction.user?.username || 'Unknown');
    reactionMap.set(reaction.emoji, existing);
  }

  return {
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    isPinned: message.isPinned,
    parentId: message.parentId,
    user: {
      id: message.user.id,
      username: message.user.username,
      displayName: message.user.displayName,
      avatarUrl: message.user.avatarUrl,
    },
    reactions: Array.from(reactionMap.values()).map((r) => ({
      ...r,
      hasReacted: false,
    })),
    attachments: (message.attachments || []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      thumbnailUrl: a.thumbnailUrl,
    })),
    replyCount: message._count?.replies || 0,
  };
}

/**
 * Clear typing indicator for a user in a channel
 */
function clearTyping(channelId: string, userId: string) {
  const channelTyping = typingUsers.get(channelId);
  if (channelTyping) {
    const timeout = channelTyping.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      channelTyping.delete(userId);
    }
    if (channelTyping.size === 0) {
      typingUsers.delete(channelId);
    }
  }
}

// =============================================================================
// CONNECTION HANDLER
// =============================================================================

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // Initialize socket data
  socket.data.channels = new Set();
  socket.data.lastPing = Date.now();

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  socket.on('auth:login', async ({ token }) => {
    const user = await verifyToken(token);

    if (!user) {
      socket.emit('auth:error', { message: 'Invalid or expired token' });
      return;
    }

    socket.data.user = user;

    // Join user's personal room for DMs
    socket.join(getUserRoom(user.id));

    // Update presence to online
    await prisma.userPresence.upsert({
      where: { userId: user.id },
      update: {
        status: 'ONLINE',
        lastActiveAt: new Date(),
        socketIds: { push: socket.id },
      },
      create: {
        userId: user.id,
        status: 'ONLINE',
        lastActiveAt: new Date(),
        socketIds: [socket.id],
      },
    });

    socket.emit('auth:success', { user });

    // Broadcast online status
    socket.broadcast.emit('presence:online', {
      userId: user.id,
      username: user.username,
    });

    console.log(`[Socket] User authenticated: ${user.username} (${user.id})`);
  });

  socket.on('auth:logout', async () => {
    if (!socket.data.user) return;

    // Leave all channels
    for (const channelId of socket.data.channels) {
      socket.leave(getChannelRoom(channelId));
      clearTyping(channelId, socket.data.user.id);
    }

    // Update presence
    await updatePresenceOnDisconnect(socket);

    socket.data.user = undefined;
    socket.data.channels.clear();
  });

  // =========================================================================
  // CHANNEL EVENTS
  // =========================================================================

  socket.on('channel:join', async ({ channelId }) => {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Verify membership
    const isMember = await isChannelMember(socket.data.user.id, channelId);
    if (!isMember) {
      socket.emit('error', { message: 'Not a member of this channel' });
      return;
    }

    const room = getChannelRoom(channelId);
    socket.join(room);
    socket.data.channels.add(channelId);

    // Get other users in the channel
    const sockets = await io.in(room).fetchSockets();
    const users = sockets
      .filter((s) => s.data.user && s.id !== socket.id)
      .map((s) => ({
        userId: s.data.user!.id,
        username: s.data.user!.username,
        displayName: s.data.user!.displayName,
        avatarUrl: s.data.user!.avatarUrl,
        status: 'ONLINE' as UserStatus,
        lastActiveAt: new Date().toISOString(),
      }));

    socket.emit('channel:joined', { channelId, users });

    // Notify others
    socket.to(room).emit('channel:user_joined', {
      channelId,
      user: {
        userId: socket.data.user.id,
        username: socket.data.user.username,
        displayName: socket.data.user.displayName,
        avatarUrl: socket.data.user.avatarUrl,
        status: 'ONLINE',
        lastActiveAt: new Date().toISOString(),
      },
    });

    console.log(`[Socket] ${socket.data.user.username} joined channel ${channelId}`);
  });

  socket.on('channel:leave', ({ channelId }) => {
    if (!socket.data.user) return;

    const room = getChannelRoom(channelId);
    socket.leave(room);
    socket.data.channels.delete(channelId);
    clearTyping(channelId, socket.data.user.id);

    socket.emit('channel:left', { channelId });
    socket.to(room).emit('channel:user_left', {
      channelId,
      userId: socket.data.user.id,
    });
  });

  // =========================================================================
  // MESSAGE EVENTS
  // =========================================================================

  socket.on('message:send', async ({ channelId, content, type = 'TEXT', parentId, tempId }) => {
    if (!socket.data.user) {
      socket.emit('message:error', { tempId, message: 'Not authenticated' });
      return;
    }

    try {
      // Verify membership
      const isMember = await isChannelMember(socket.data.user.id, channelId);
      if (!isMember) {
        socket.emit('message:error', { tempId, message: 'Not a channel member' });
        return;
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          channelId,
          userId: socket.data.user.id,
          content,
          type,
          parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reactions: true,
          attachments: true,
          _count: { select: { replies: true } },
        },
      });

      const formattedMessage = formatMessage(message);

      // Send confirmation to sender
      if (tempId) {
        socket.emit('message:sent', { tempId, message: formattedMessage });
      }

      // Broadcast to channel
      io.to(getChannelRoom(channelId)).emit('message:new', {
        channelId,
        message: formattedMessage,
      });

      // Clear typing indicator
      clearTyping(channelId, socket.data.user.id);
      io.to(getChannelRoom(channelId)).emit('typing:stopped', {
        channelId,
        userId: socket.data.user.id,
      });

    } catch (error) {
      console.error('[Socket] Error sending message:', error);
      socket.emit('message:error', { tempId, message: 'Failed to send message' });
    }
  });

  socket.on('message:edit', async ({ messageId, content }) => {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Get and verify message
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { userId: true, channelId: true, version: true },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.userId !== socket.data.user.id) {
        socket.emit('error', { message: 'Cannot edit others messages' });
        return;
      }

      // Update message
      const updated = await prisma.message.update({
        where: { id: messageId, version: message.version },
        data: {
          content,
          isEdited: true,
          editedAt: new Date(),
          version: { increment: 1 },
        },
      });

      // Broadcast update
      io.to(getChannelRoom(message.channelId)).emit('message:updated', {
        channelId: message.channelId,
        messageId,
        content,
        updatedAt: updated.updatedAt.toISOString(),
      });

    } catch (error) {
      console.error('[Socket] Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  socket.on('message:delete', async ({ messageId }) => {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { userId: true, channelId: true },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check permission (author or moderator)
      const isAuthor = message.userId === socket.data.user.id;
      let isModerator = false;

      if (!isAuthor) {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId: message.channelId, userId: socket.data.user.id } },
        });
        isModerator = member?.role === 'OWNER' || member?.role === 'ADMIN' || member?.role === 'MODERATOR';
      }

      if (!isAuthor && !isModerator) {
        socket.emit('error', { message: 'Cannot delete this message' });
        return;
      }

      // Soft delete
      await prisma.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: '[This message has been deleted]',
        },
      });

      // Broadcast deletion
      io.to(getChannelRoom(message.channelId)).emit('message:deleted', {
        channelId: message.channelId,
        messageId,
      });

    } catch (error) {
      console.error('[Socket] Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // =========================================================================
  // TYPING INDICATORS
  // =========================================================================

  socket.on('typing:start', ({ channelId }) => {
    if (!socket.data.user) return;

    const userId = socket.data.user.id;

    // Clear existing timeout
    clearTyping(channelId, userId);

    // Set up new timeout
    if (!typingUsers.has(channelId)) {
      typingUsers.set(channelId, new Map());
    }

    const channelTyping = typingUsers.get(channelId)!;
    const timeout = setTimeout(() => {
      clearTyping(channelId, userId);
      io.to(getChannelRoom(channelId)).emit('typing:stopped', { channelId, userId });
    }, TYPING_TIMEOUT);

    channelTyping.set(userId, timeout);

    // Broadcast typing
    socket.to(getChannelRoom(channelId)).emit('typing:started', {
      channelId,
      userId,
      username: socket.data.user.username,
    });
  });

  socket.on('typing:stop', ({ channelId }) => {
    if (!socket.data.user) return;

    clearTyping(channelId, socket.data.user.id);
    socket.to(getChannelRoom(channelId)).emit('typing:stopped', {
      channelId,
      userId: socket.data.user.id,
    });
  });

  // =========================================================================
  // REACTIONS
  // =========================================================================

  socket.on('reaction:add', async ({ messageId, emoji }) => {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { channelId: true },
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Create reaction (ignore if duplicate)
      await prisma.messageReaction.create({
        data: {
          messageId,
          userId: socket.data.user.id,
          emoji,
        },
      }).catch(() => {
        // Ignore duplicate
      });

      // Broadcast
      io.to(getChannelRoom(message.channelId)).emit('reaction:added', {
        channelId: message.channelId,
        messageId,
        emoji,
        userId: socket.data.user.id,
        username: socket.data.user.username,
      });

    } catch (error) {
      console.error('[Socket] Error adding reaction:', error);
    }
  });

  socket.on('reaction:remove', async ({ messageId, emoji }) => {
    if (!socket.data.user) return;

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { channelId: true },
      });

      if (!message) return;

      await prisma.messageReaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId: socket.data.user.id,
            emoji,
          },
        },
      }).catch(() => {});

      io.to(getChannelRoom(message.channelId)).emit('reaction:removed', {
        channelId: message.channelId,
        messageId,
        emoji,
        userId: socket.data.user.id,
      });

    } catch (error) {
      console.error('[Socket] Error removing reaction:', error);
    }
  });

  // =========================================================================
  // DIRECT MESSAGES
  // =========================================================================

  socket.on('dm:send', async ({ recipientId, content, type = 'TEXT', tempId }) => {
    if (!socket.data.user) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const userId = socket.data.user.id;

      // Ensure ordering for conversation lookup
      const [userAId, userBId] = userId < recipientId ? [userId, recipientId] : [recipientId, userId];

      // Find or create conversation
      let conversation = await prisma.directConversation.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
      });

      if (!conversation) {
        conversation = await prisma.directConversation.create({
          data: { userAId, userBId },
        });
      }

      // Create message
      const message = await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content,
          type,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          attachments: true,
        },
      });

      // Update conversation
      await prisma.directConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      const dmData: SocketDirectMessage = {
        id: message.id,
        conversationId: conversation.id,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        isEdited: message.isEdited,
        isRead: false,
        sender: message.sender,
        attachments: message.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          thumbnailUrl: a.thumbnailUrl || undefined,
        })),
      };

      // Confirm to sender
      if (tempId) {
        socket.emit('dm:sent', { tempId, message: dmData });
      }

      // Send to recipient
      io.to(getUserRoom(recipientId)).emit('dm:new', {
        conversationId: conversation.id,
        message: dmData,
      });

    } catch (error) {
      console.error('[Socket] Error sending DM:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('dm:read', async ({ conversationId }) => {
    if (!socket.data.user) return;

    try {
      const conversation = await prisma.directConversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) return;

      // Verify participant
      if (conversation.userAId !== socket.data.user.id && conversation.userBId !== socket.data.user.id) {
        return;
      }

      // Mark messages as read
      await prisma.directMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: socket.data.user.id },
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });

      // Notify the other user
      const otherUserId = conversation.userAId === socket.data.user.id
        ? conversation.userBId
        : conversation.userAId;

      io.to(getUserRoom(otherUserId)).emit('dm:read', {
        conversationId,
        readBy: socket.data.user.id,
      });

    } catch (error) {
      console.error('[Socket] Error marking DM read:', error);
    }
  });

  // =========================================================================
  // PRESENCE
  // =========================================================================

  socket.on('presence:update', async ({ status, statusText }) => {
    if (!socket.data.user) return;

    try {
      await prisma.userPresence.upsert({
        where: { userId: socket.data.user.id },
        update: {
          status,
          statusText: statusText || null,
          lastActiveAt: new Date(),
        },
        create: {
          userId: socket.data.user.id,
          status,
          statusText: statusText || null,
          socketIds: [socket.id],
        },
      });

      // Broadcast to all connected sockets
      socket.broadcast.emit('presence:changed', {
        userId: socket.data.user.id,
        username: socket.data.user.username,
        displayName: socket.data.user.displayName,
        avatarUrl: socket.data.user.avatarUrl,
        status,
        statusText,
        lastActiveAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('[Socket] Error updating presence:', error);
    }
  });

  // =========================================================================
  // PING/PONG
  // =========================================================================

  socket.on('ping', () => {
    socket.data.lastPing = Date.now();
    socket.emit('pong');
  });

  // =========================================================================
  // DISCONNECT
  // =========================================================================

  socket.on('disconnect', async (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);

    if (socket.data.user) {
      // Clear typing indicators
      for (const channelId of socket.data.channels) {
        clearTyping(channelId, socket.data.user.id);
      }

      await updatePresenceOnDisconnect(socket);
    }
  });
});

/**
 * Update presence when socket disconnects
 */
async function updatePresenceOnDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  if (!socket.data.user) return;

  try {
    const presence = await prisma.userPresence.findUnique({
      where: { userId: socket.data.user.id },
    });

    if (!presence) return;

    // Remove this socket ID
    const updatedSocketIds = presence.socketIds.filter((id) => id !== socket.id);

    if (updatedSocketIds.length === 0) {
      // No more connections, set offline
      await prisma.userPresence.update({
        where: { userId: socket.data.user.id },
        data: {
          status: 'OFFLINE',
          lastActiveAt: new Date(),
          socketIds: [],
        },
      });

      socket.broadcast.emit('presence:offline', {
        userId: socket.data.user.id,
      });
    } else {
      // Still has other connections
      await prisma.userPresence.update({
        where: { userId: socket.data.user.id },
        data: { socketIds: updatedSocketIds },
      });
    }
  } catch (error) {
    console.error('[Socket] Error updating presence on disconnect:', error);
  }
}

// =============================================================================
// START SERVER
// =============================================================================

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 ConnectNow Socket.IO Server                             ║
║                                                               ║
║   Running on: http://localhost:${PORT}                          ║
║   CORS Origin: ${CORS_ORIGIN}                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Socket] Shutting down...');
  io.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Socket] Shutting down...');
  io.close();
  await prisma.$disconnect();
  process.exit(0);
});
