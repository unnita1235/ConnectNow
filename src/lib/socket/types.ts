/**
 * Socket.IO Type Definitions
 * =============================================================================
 * Shared types for Socket.IO events between client and server.
 */

import type { UserStatus, MessageType } from '@prisma/client';

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * Socket user data (attached to socket after authentication)
 */
export interface SocketUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * User presence data
 */
export interface UserPresenceData {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  statusText?: string;
  lastActiveAt: string;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Message author data
 */
export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Attachment data
 */
export interface AttachmentData {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

/**
 * Reaction data
 */
export interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

/**
 * Full message data for Socket events
 */
export interface SocketMessage {
  id: string;
  channelId: string;
  content: string;
  type: MessageType;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  parentId: string | null;
  user: MessageAuthor;
  reactions: ReactionData[];
  attachments: AttachmentData[];
  replyCount: number;
}

/**
 * Direct message data
 */
export interface SocketDirectMessage {
  id: string;
  conversationId: string;
  content: string;
  type: MessageType;
  createdAt: string;
  isEdited: boolean;
  isRead: boolean;
  sender: MessageAuthor;
  attachments: AttachmentData[];
}

// =============================================================================
// CLIENT -> SERVER EVENTS
// =============================================================================

/**
 * Events sent from client to server
 */
export interface ClientToServerEvents {
  // Authentication
  'auth:login': (data: { token: string }) => void;
  'auth:logout': () => void;

  // Channel events
  'channel:join': (data: { channelId: string }) => void;
  'channel:leave': (data: { channelId: string }) => void;

  // Message events
  'message:send': (data: {
    channelId: string;
    content: string;
    type?: MessageType;
    parentId?: string;
    tempId?: string; // Client-side temp ID for optimistic updates
  }) => void;
  'message:edit': (data: {
    messageId: string;
    content: string;
  }) => void;
  'message:delete': (data: { messageId: string }) => void;

  // Typing indicators
  'typing:start': (data: { channelId: string }) => void;
  'typing:stop': (data: { channelId: string }) => void;

  // Reactions
  'reaction:add': (data: {
    messageId: string;
    emoji: string;
  }) => void;
  'reaction:remove': (data: {
    messageId: string;
    emoji: string;
  }) => void;

  // Direct messages
  'dm:send': (data: {
    recipientId: string;
    content: string;
    type?: MessageType;
    tempId?: string;
  }) => void;
  'dm:read': (data: { conversationId: string }) => void;

  // Presence
  'presence:update': (data: {
    status: UserStatus;
    statusText?: string;
  }) => void;

  // Ping for connection health
  'ping': () => void;
}

// =============================================================================
// SERVER -> CLIENT EVENTS
// =============================================================================

/**
 * Events sent from server to client
 */
export interface ServerToClientEvents {
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'error': (data: { message: string; code?: string }) => void;

  // Authentication
  'auth:success': (data: { user: SocketUser }) => void;
  'auth:error': (data: { message: string }) => void;

  // Channel events
  'channel:joined': (data: { channelId: string; users: UserPresenceData[] }) => void;
  'channel:left': (data: { channelId: string }) => void;
  'channel:user_joined': (data: { channelId: string; user: UserPresenceData }) => void;
  'channel:user_left': (data: { channelId: string; userId: string }) => void;

  // Message events
  'message:new': (data: { channelId: string; message: SocketMessage }) => void;
  'message:updated': (data: {
    channelId: string;
    messageId: string;
    content: string;
    updatedAt: string;
  }) => void;
  'message:deleted': (data: { channelId: string; messageId: string }) => void;
  'message:sent': (data: { tempId: string; message: SocketMessage }) => void;
  'message:error': (data: { tempId?: string; message: string }) => void;

  // Typing indicators
  'typing:started': (data: {
    channelId: string;
    userId: string;
    username: string;
  }) => void;
  'typing:stopped': (data: { channelId: string; userId: string }) => void;

  // Reactions
  'reaction:added': (data: {
    channelId: string;
    messageId: string;
    emoji: string;
    userId: string;
    username: string;
  }) => void;
  'reaction:removed': (data: {
    channelId: string;
    messageId: string;
    emoji: string;
    userId: string;
  }) => void;

  // Direct messages
  'dm:new': (data: {
    conversationId: string;
    message: SocketDirectMessage;
  }) => void;
  'dm:sent': (data: { tempId: string; message: SocketDirectMessage }) => void;
  'dm:read': (data: { conversationId: string; readBy: string }) => void;

  // Presence
  'presence:changed': (data: UserPresenceData) => void;
  'presence:online': (data: { userId: string; username: string }) => void;
  'presence:offline': (data: { userId: string }) => void;

  // Ping response
  'pong': () => void;
}

// =============================================================================
// INTER-SERVER EVENTS (for Redis adapter)
// =============================================================================

export interface InterServerEvents {
  'broadcast:message': (data: { channelId: string; message: SocketMessage }) => void;
  'broadcast:presence': (data: UserPresenceData) => void;
}

// =============================================================================
// SOCKET DATA
// =============================================================================

/**
 * Data attached to each socket connection
 */
export interface SocketData {
  user?: SocketUser;
  channels: Set<string>;
  lastPing: number;
}

// =============================================================================
// ROOM NAMING CONVENTIONS
// =============================================================================

/**
 * Generate room name for a channel
 */
export const getChannelRoom = (channelId: string) => `channel:${channelId}`;

/**
 * Generate room name for a user (for DMs and notifications)
 */
export const getUserRoom = (userId: string) => `user:${userId}`;

/**
 * Generate room name for a workspace
 */
export const getWorkspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
