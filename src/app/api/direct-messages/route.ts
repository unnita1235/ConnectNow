/**
 * Direct Messages API Routes
 * =============================================================================
 * GET  /api/direct-messages - List user's DM conversations
 * POST /api/direct-messages - Send a direct message
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  createdResponse,
  successResponse,
  validationErrorResponse,
  paginatedResponse,
  notFoundResponse,
} from '@/lib/api-utils';
import { createDirectMessageSchema, paginationSchema } from '@/lib/validations/api';

// TODO: Rate limit - 60 DMs/min per user

/**
 * GET /api/direct-messages
 *
 * Lists all DM conversations for the current user.
 * Sorted by last message time (most recent first).
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 20)
 *
 * Response:
 * {
 *   data: [
 *     {
 *       id,
 *       otherUser: { id, username, displayName, avatarUrl, status },
 *       lastMessage: { content, createdAt, isRead },
 *       unreadCount
 *     }
 *   ],
 *   pagination: { ... }
 * }
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse pagination
  const searchParams = request.nextUrl.searchParams;
  const parseResult = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit') || '20',
  });

  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { page, limit } = parseResult.data;
  const skip = (page - 1) * limit;

  // Get conversations where user is participant
  const [conversations, total] = await Promise.all([
    prisma.directConversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            presence: {
              select: {
                status: true,
                lastActiveAt: true,
              },
            },
          },
        },
        userB: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            presence: {
              select: {
                status: true,
                lastActiveAt: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            isRead: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.directConversation.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    }),
  ]);

  // Get unread counts for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await prisma.directMessage.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          isRead: false,
          isDeleted: false,
        },
      });

      // Determine the other user
      const otherUser = conv.userAId === userId ? conv.userB : conv.userA;
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl,
          status: otherUser.presence?.status || 'OFFLINE',
          lastActiveAt: otherUser.presence?.lastActiveAt,
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              isFromMe: lastMessage.senderId === userId,
              isRead: lastMessage.isRead,
            }
          : null,
        unreadCount,
        createdAt: conv.createdAt,
        lastMessageAt: conv.lastMessageAt,
      };
    })
  );

  return paginatedResponse(conversationsWithUnread, total, page, limit);
}

/**
 * POST /api/direct-messages
 *
 * Send a direct message to another user.
 * Creates conversation if it doesn't exist.
 *
 * Request body:
 * {
 *   recipientId: string,
 *   content: string,
 *   type?: 'TEXT' | 'IMAGE' | 'FILE'
 * }
 *
 * Response:
 * {
 *   id, conversationId, content, createdAt,
 *   sender: { id, username, displayName, avatarUrl }
 * }
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId, user } = authResult;

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = createDirectMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { recipientId, content, type } = parseResult.data;

  // Can't message yourself
  if (recipientId === userId) {
    return successResponse({ error: 'Cannot send a message to yourself' }, 400);
  }

  // Check recipient exists
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, username: true, isActive: true, isBanned: true },
  });

  if (!recipient) {
    return notFoundResponse('Recipient');
  }

  if (!recipient.isActive || recipient.isBanned) {
    return successResponse({ error: 'Cannot message this user' }, 400);
  }

  // Ensure proper ordering for conversation lookup (userAId < userBId)
  const [userAId, userBId] =
    userId < recipientId ? [userId, recipientId] : [recipientId, userId];

  // Find or create conversation
  let conversation = await prisma.directConversation.findUnique({
    where: {
      userAId_userBId: { userAId, userBId },
    },
  });

  if (!conversation) {
    conversation = await prisma.directConversation.create({
      data: { userAId, userBId },
    });
  }

  // Create message and update conversation
  const [message] = await prisma.$transaction([
    prisma.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content,
        type,
      },
    }),
    prisma.directConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  // TODO: Emit Socket.io event "dm:new"
  // io.to(`user:${recipientId}`).emit('dm:new', {
  //   conversationId: conversation.id,
  //   message: { ... }
  // });

  return createdResponse({
    id: message.id,
    conversationId: conversation.id,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    sender: {
      id: userId,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
}
