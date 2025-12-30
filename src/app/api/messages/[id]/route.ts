/**
 * Single Message API Routes
 * =============================================================================
 * GET    /api/messages/[id] - Get a single message
 * PUT    /api/messages/[id] - Update a message
 * DELETE /api/messages/[id] - Delete a message (soft delete)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isChannelModerator } from '@/lib/auth/server';
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api-utils';
import { updateMessageSchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/messages/[id]
 *
 * Response:
 * {
 *   id, content, type, createdAt, updatedAt,
 *   isEdited, isDeleted, isPinned,
 *   user: { id, username, displayName, avatarUrl },
 *   reactions: [...],
 *   attachments: [...],
 *   replies: [...] (if it's a parent message)
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: messageId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get message with all related data
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      channel: {
        select: {
          id: true,
          workspaceId: true,
          isPrivate: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      },
      attachments: true,
      replies: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        take: 10, // Limit initial replies
      },
      _count: {
        select: { replies: true },
      },
    },
  });

  if (!message) {
    return notFoundResponse('Message');
  }

  // Check user has access to the channel
  if (message.channel.isPrivate) {
    const channelMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: message.channelId,
          userId,
        },
      },
    });

    if (!channelMember) {
      return forbiddenResponse('You do not have access to this message');
    }
  } else {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: message.channel.workspaceId,
          userId,
        },
      },
    });

    if (!workspaceMember) {
      return forbiddenResponse('You do not have access to this message');
    }
  }

  // Group reactions
  const reactionMap = new Map<
    string,
    { emoji: string; count: number; users: string[]; hasReacted: boolean }
  >();

  for (const reaction of message.reactions) {
    const existing = reactionMap.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      users: [],
      hasReacted: false,
    };
    existing.count++;
    existing.users.push(reaction.user.displayName || reaction.user.username);
    if (reaction.userId === userId) {
      existing.hasReacted = true;
    }
    reactionMap.set(reaction.emoji, existing);
  }

  return successResponse({
    id: message.id,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    isPinned: message.isPinned,
    channelId: message.channelId,
    parentId: message.parentId,
    user: message.user,
    reactions: Array.from(reactionMap.values()),
    attachments: message.attachments,
    replies: message.replies,
    replyCount: message._count.replies,
  });
}

/**
 * PUT /api/messages/[id]
 *
 * Request body:
 * {
 *   content: string
 * }
 *
 * Only the message author can edit their message.
 * Broadcasts "message:updated" via Socket.io.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: messageId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = updateMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { content } = parseResult.data;

  // Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      userId: true,
      channelId: true,
      isDeleted: true,
      version: true,
    },
  });

  if (!message) {
    return notFoundResponse('Message');
  }

  if (message.isDeleted) {
    return successResponse({ error: 'Cannot edit a deleted message' }, 400);
  }

  // Only author can edit
  if (message.userId !== userId) {
    return forbiddenResponse('You can only edit your own messages');
  }

  // Update message with optimistic locking
  const updatedMessage = await prisma.message.update({
    where: {
      id: messageId,
      version: message.version, // Optimistic lock
    },
    data: {
      content,
      isEdited: true,
      editedAt: new Date(),
      version: { increment: 1 },
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
    },
  });

  // TODO: Emit Socket.io event "message:updated"
  // io.to(message.channelId).emit('message:updated', {
  //   channelId: message.channelId,
  //   messageId: updatedMessage.id,
  //   content: updatedMessage.content,
  //   updatedAt: updatedMessage.updatedAt,
  // });

  return successResponse({
    id: updatedMessage.id,
    content: updatedMessage.content,
    updatedAt: updatedMessage.updatedAt,
    isEdited: updatedMessage.isEdited,
  });
}

/**
 * DELETE /api/messages/[id]
 *
 * Soft deletes the message (sets isDeleted=true, clears content).
 * Author or channel moderators can delete.
 * Broadcasts "message:deleted" via Socket.io.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: messageId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      userId: true,
      channelId: true,
      isDeleted: true,
    },
  });

  if (!message) {
    return notFoundResponse('Message');
  }

  if (message.isDeleted) {
    return successResponse({ error: 'Message already deleted' }, 400);
  }

  // Check permission: author or channel moderator
  const isAuthor = message.userId === userId;
  const isModerator = await isChannelModerator(userId, message.channelId);

  if (!isAuthor && !isModerator) {
    return forbiddenResponse('You do not have permission to delete this message');
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

  // TODO: Emit Socket.io event "message:deleted"
  // io.to(message.channelId).emit('message:deleted', {
  //   channelId: message.channelId,
  //   messageId: message.id,
  // });

  return noContentResponse();
}
