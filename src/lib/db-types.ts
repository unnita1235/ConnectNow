/**
 * Database Types and Interfaces
 * =============================================================================
 * Extended TypeScript types that bridge Prisma models with frontend usage.
 * These types provide additional utility for API responses and frontend state.
 */

import type {
  User as PrismaUser,
  Session as PrismaSession,
  Workspace as PrismaWorkspace,
  WorkspaceMember as PrismaWorkspaceMember,
  Channel as PrismaChannel,
  ChannelMember as PrismaChannelMember,
  Message as PrismaMessage,
  MessageReaction as PrismaMessageReaction,
  DirectConversation as PrismaDirectConversation,
  DirectMessage as PrismaDirectMessage,
  UserPresence as PrismaUserPresence,
  Attachment as PrismaAttachment,
  UserStatus,
  ChannelType,
  MemberRole,
  MessageType,
} from '@prisma/client';

// Re-export enums for convenience
export { UserStatus, ChannelType, MemberRole, MessageType };

// =============================================================================
// BASE TYPES (Direct Prisma exports with safe field omissions)
// =============================================================================

/**
 * User type without sensitive fields (password, tokens)
 * Safe to send to frontend
 */
export type SafeUser = Omit<PrismaUser, 'passwordHash'>;

/**
 * Full user type (only for internal server use)
 */
export type User = PrismaUser;

/**
 * Session type
 */
export type Session = PrismaSession;

/**
 * Workspace type
 */
export type Workspace = PrismaWorkspace;

/**
 * Workspace member type
 */
export type WorkspaceMember = PrismaWorkspaceMember;

/**
 * Channel type
 */
export type Channel = PrismaChannel;

/**
 * Channel member type
 */
export type ChannelMember = PrismaChannelMember;

/**
 * Message type
 */
export type Message = PrismaMessage;

/**
 * Message reaction type
 */
export type MessageReaction = PrismaMessageReaction;

/**
 * Direct conversation type
 */
export type DirectConversation = PrismaDirectConversation;

/**
 * Direct message type
 */
export type DirectMessage = PrismaDirectMessage;

/**
 * User presence type
 */
export type UserPresence = PrismaUserPresence;

/**
 * Attachment type
 */
export type Attachment = PrismaAttachment;

// =============================================================================
// EXTENDED TYPES (With relationships loaded)
// =============================================================================

/**
 * User with presence information
 */
export type UserWithPresence = SafeUser & {
  presence: UserPresence | null;
};

/**
 * User with all related data
 */
export type UserWithRelations = SafeUser & {
  presence: UserPresence | null;
  workspaceMemberships: (WorkspaceMember & {
    workspace: Workspace;
  })[];
};

/**
 * Workspace with member count
 */
export type WorkspaceWithCount = Workspace & {
  _count: {
    members: number;
    channels: number;
  };
};

/**
 * Workspace with owner and members
 */
export type WorkspaceWithMembers = Workspace & {
  owner: SafeUser;
  members: (WorkspaceMember & {
    user: SafeUser & {
      presence: UserPresence | null;
    };
  })[];
};

/**
 * Channel with member count
 */
export type ChannelWithCount = Channel & {
  _count: {
    members: number;
    messages: number;
  };
};

/**
 * Channel with members and unread info
 */
export type ChannelWithMembers = Channel & {
  members: (ChannelMember & {
    user: SafeUser & {
      presence: UserPresence | null;
    };
  })[];
  _count: {
    messages: number;
  };
};

/**
 * Message with author and reactions
 */
export type MessageWithAuthor = Message & {
  user: SafeUser;
  reactions: (MessageReaction & {
    user: Pick<SafeUser, 'id' | 'username' | 'displayName'>;
  })[];
  attachments: Attachment[];
  _count?: {
    replies: number;
  };
};

/**
 * Message for frontend display (includes formatted fields)
 */
export type DisplayMessage = {
  id: string;
  content: string;
  type: MessageType;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    status: UserStatus;
  };
  timestamp: string; // ISO string
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  reactions: {
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean; // Current user has reacted
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    thumbnailUrl: string | null;
  }[];
  replyCount: number;
  parentId: string | null;
};

/**
 * Direct conversation with participant info
 */
export type DirectConversationWithParticipants = DirectConversation & {
  userA: SafeUser & {
    presence: UserPresence | null;
  };
  userB: SafeUser & {
    presence: UserPresence | null;
  };
  messages: DirectMessage[];
};

/**
 * Direct message with sender
 */
export type DirectMessageWithSender = DirectMessage & {
  sender: SafeUser;
  attachments: Attachment[];
};

// =============================================================================
// API REQUEST TYPES
// =============================================================================

/**
 * Create user request
 */
export type CreateUserInput = {
  email: string;
  username: string;
  password: string;
  displayName?: string;
};

/**
 * Update user request
 */
export type UpdateUserInput = Partial<{
  displayName: string;
  avatarUrl: string;
  bio: string;
}>;

/**
 * Login request
 */
export type LoginInput = {
  email: string;
  password: string;
};

/**
 * Create workspace request
 */
export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  description?: string;
};

/**
 * Create channel request
 */
export type CreateChannelInput = {
  workspaceId: string;
  name: string;
  description?: string;
  type?: ChannelType;
  isPrivate?: boolean;
};

/**
 * Send message request
 */
export type SendMessageInput = {
  channelId: string;
  content: string;
  type?: MessageType;
  parentId?: string;
};

/**
 * Send direct message request
 */
export type SendDirectMessageInput = {
  recipientId: string;
  content: string;
  type?: MessageType;
};

/**
 * Update message request
 */
export type UpdateMessageInput = {
  content: string;
};

/**
 * Add reaction request
 */
export type AddReactionInput = {
  emoji: string;
};

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Authentication response
 */
export type AuthResponse = {
  user: SafeUser;
  token: string;
  refreshToken?: string;
  expiresAt: string;
};

/**
 * Paginated response wrapper
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

/**
 * Error response
 */
export type ApiError = {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
};

/**
 * Success response with message
 */
export type SuccessResponse = {
  success: true;
  message?: string;
};

// =============================================================================
// SOCKET.IO EVENT TYPES
// =============================================================================

/**
 * New message event payload
 */
export type MessageNewEvent = {
  channelId: string;
  message: DisplayMessage;
};

/**
 * Message updated event payload
 */
export type MessageUpdatedEvent = {
  channelId: string;
  messageId: string;
  content: string;
  updatedAt: string;
};

/**
 * Message deleted event payload
 */
export type MessageDeletedEvent = {
  channelId: string;
  messageId: string;
};

/**
 * Typing indicator event payload
 */
export type TypingEvent = {
  channelId: string;
  userId: string;
  username: string;
};

/**
 * User presence change event payload
 */
export type PresenceEvent = {
  userId: string;
  status: UserStatus;
  lastActiveAt: string;
};

/**
 * Reaction added/removed event payload
 */
export type ReactionEvent = {
  channelId: string;
  messageId: string;
  reaction: {
    emoji: string;
    userId: string;
    username: string;
    action: 'add' | 'remove';
  };
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Pagination params
 */
export type PaginationParams = {
  page?: number;
  limit?: number;
  cursor?: string;
};

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Message filter params
 */
export type MessageFilterParams = PaginationParams & {
  before?: string; // Message ID or timestamp
  after?: string;
  userId?: string;
  type?: MessageType;
  search?: string;
};

/**
 * User filter params
 */
export type UserFilterParams = PaginationParams & {
  status?: UserStatus;
  search?: string;
  workspaceId?: string;
};

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if a value is a valid UserStatus
 */
export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === 'string' &&
    ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'].includes(value)
  );
}

/**
 * Check if a value is a valid MessageType
 */
export function isMessageType(value: unknown): value is MessageType {
  return (
    typeof value === 'string' &&
    ['TEXT', 'IMAGE', 'FILE', 'VIDEO', 'AUDIO', 'SYSTEM'].includes(value)
  );
}

/**
 * Check if a value is a valid MemberRole
 */
export function isMemberRole(value: unknown): value is MemberRole {
  return (
    typeof value === 'string' &&
    ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'GUEST'].includes(value)
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert Prisma user to safe user (remove password)
 */
export function toSafeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Convert message with relations to display format
 */
export function toDisplayMessage(
  message: MessageWithAuthor,
  currentUserId: string
): DisplayMessage {
  // Group reactions by emoji
  const reactionMap = new Map<
    string,
    { count: number; users: string[]; hasReacted: boolean }
  >();

  for (const reaction of message.reactions) {
    const existing = reactionMap.get(reaction.emoji) || {
      count: 0,
      users: [],
      hasReacted: false,
    };
    existing.count++;
    existing.users.push(reaction.user.displayName || reaction.user.username);
    if (reaction.userId === currentUserId) {
      existing.hasReacted = true;
    }
    reactionMap.set(reaction.emoji, existing);
  }

  return {
    id: message.id,
    content: message.content,
    type: message.type,
    author: {
      id: message.user.id,
      name: message.user.displayName || message.user.username,
      avatarUrl: message.user.avatarUrl,
      status: UserStatus.ONLINE, // Would come from presence
    },
    timestamp: message.createdAt.toISOString(),
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    isPinned: message.isPinned,
    reactions: Array.from(reactionMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    })),
    attachments: message.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      thumbnailUrl: a.thumbnailUrl,
    })),
    replyCount: message._count?.replies || 0,
    parentId: message.parentId,
  };
}
