/**
 * Channel Messages API Routes
 * =============================================================================
 * GET /api/channels/[id]/messages - Get messages in a channel (paginated)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireChannelMember } from '@/lib/auth/server';
import {
  successResponse,
  validationErrorResponse,
  paginatedResponse,
} from '@/lib/api-utils';
import { messageQuerySchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/channels/[id]/messages
 *
 * Query parameters:
 * - page (default: 1): Page number
 * - limit (default: 50): Messages per page
 * - before (optional): Get messages before this message ID
 * - after (optional): Get messages after this message ID
 * - includeDeleted (default: false): Include deleted messages
 *
 * Response:
 * {
 *   data: Message[],
 *   pagination: { page, limit, total, totalPages, hasMore }
 * }
 *
 * Each message includes:
 * - id, content, type, createdAt, updatedAt
 * - isEdited, isDeleted, isPinned
 * - user: { id, username, displayName, avatarUrl }
 * - reactions: [{ emoji, count, users }]
 * - attachments: [{ id, fileName, fileUrl, fileSize, mimeType }]
 * - _count: { replies }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: channelId } = await params;

  // Check authentication and channel access
  const authResult = await requireChannelMember(channelId);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const parseResult = messageQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    before: searchParams.get('before'),
    after: searchParams.get('after'),
    includeDeleted: searchParams.get('includeDeleted'),
  });

  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { page, limit, before, after, includeDeleted } = parseResult.data;
  const skip = (page - 1) * limit;

  // Build cursor-based query if before/after provided
  let cursorWhere = {};
  if (before) {
    const beforeMessage = await prisma.message.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });
    if (beforeMessage) {
      cursorWhere = { createdAt: { lt: beforeMessage.createdAt } };
    }
  } else if (after) {
    const afterMessage = await prisma.message.findUnique({
      where: { id: after },
      select: { createdAt: true },
    });
    if (afterMessage) {
      cursorWhere = { createdAt: { gt: afterMessage.createdAt } };
    }
  }

  // Build where clause
  const where = {
    channelId,
    parentId: null, // Only top-level messages
    ...(!includeDeleted && { isDeleted: false }),
    ...cursorWhere,
  };

  // Get messages with user info and reactions
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            presence: {
              select: {
                status: true,
              },
            },
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
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            thumbnailUrl: true,
            width: true,
            height: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.message.count({ where }),
  ]);

  // Group reactions by emoji
  const formattedMessages = messages.map((message) => {
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

    return {
      id: message.id,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
      isPinned: message.isPinned,
      parentId: message.parentId,
      user: {
        id: message.user.id,
        username: message.user.username,
        displayName: message.user.displayName,
        avatarUrl: message.user.avatarUrl,
        status: message.user.presence?.status || 'OFFLINE',
      },
      reactions: Array.from(reactionMap.values()),
      attachments: message.attachments,
      replyCount: message._count.replies,
    };
  });

  // Update last read time for user
  await prisma.channelMember.update({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    data: {
      lastReadAt: new Date(),
      lastReadMessageId: messages[0]?.id,
    },
  }).catch(() => {
    // Ignore if update fails (user might have left channel)
  });

  return paginatedResponse(formattedMessages, total, page, limit);
}
