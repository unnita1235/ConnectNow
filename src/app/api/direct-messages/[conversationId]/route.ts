/**
 * Direct Conversation API Routes
 * =============================================================================
 * GET /api/direct-messages/[conversationId] - Get messages in a conversation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  successResponse,
  validationErrorResponse,
  paginatedResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/api-utils';
import { dmQuerySchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

/**
 * GET /api/direct-messages/[conversationId]
 *
 * Get messages in a direct conversation (paginated).
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 50)
 * - before (optional): Get messages before this message ID
 * - after (optional): Get messages after this message ID
 *
 * Response:
 * {
 *   data: [
 *     {
 *       id, content, type, createdAt,
 *       sender: { id, username, displayName, avatarUrl },
 *       isEdited, isRead
 *     }
 *   ],
 *   conversation: {
 *     id,
 *     otherUser: { id, username, displayName, avatarUrl, status }
 *   },
 *   pagination: { ... }
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get conversation and verify access
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
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
    },
  });

  if (!conversation) {
    return notFoundResponse('Conversation');
  }

  // Check user is participant
  if (conversation.userAId !== userId && conversation.userBId !== userId) {
    return forbiddenResponse('You are not a participant in this conversation');
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const parseResult = dmQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    before: searchParams.get('before'),
    after: searchParams.get('after'),
  });

  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { page, limit, before, after } = parseResult.data;
  const skip = (page - 1) * limit;

  // Build cursor-based query
  let cursorWhere = {};
  if (before) {
    const beforeMessage = await prisma.directMessage.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });
    if (beforeMessage) {
      cursorWhere = { createdAt: { lt: beforeMessage.createdAt } };
    }
  } else if (after) {
    const afterMessage = await prisma.directMessage.findUnique({
      where: { id: after },
      select: { createdAt: true },
    });
    if (afterMessage) {
      cursorWhere = { createdAt: { gt: afterMessage.createdAt } };
    }
  }

  // Get messages
  const where = {
    conversationId,
    isDeleted: false,
    ...cursorWhere,
  };

  const [messages, total] = await Promise.all([
    prisma.directMessage.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.directMessage.count({ where }),
  ]);

  // Mark messages as read
  await prisma.directMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  // Determine other user
  const otherUser =
    conversation.userAId === userId ? conversation.userB : conversation.userA;

  // Format response
  const formattedMessages = messages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    type: msg.type,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    isEdited: msg.isEdited,
    isRead: msg.isRead,
    isFromMe: msg.senderId === userId,
    sender: {
      id: msg.sender.id,
      username: msg.sender.username,
      displayName: msg.sender.displayName,
      avatarUrl: msg.sender.avatarUrl,
    },
    attachments: msg.attachments,
  }));

  return successResponse({
    conversation: {
      id: conversation.id,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        displayName: otherUser.displayName,
        avatarUrl: otherUser.avatarUrl,
        status: otherUser.presence?.status || 'OFFLINE',
        lastActiveAt: otherUser.presence?.lastActiveAt,
      },
    },
    ...paginatedResponse(formattedMessages, total, page, limit),
  });
}
