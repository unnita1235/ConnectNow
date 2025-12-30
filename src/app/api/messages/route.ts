/**
 * Messages API Routes
 * =============================================================================
 * POST /api/messages - Create a new message
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireChannelMember } from '@/lib/auth/server';
import {
  createdResponse,
  successResponse,
  validationErrorResponse,
  notFoundResponse,
} from '@/lib/api-utils';
import { createMessageSchema } from '@/lib/validations/api';

// TODO: Rate limit - 60 messages/min per user

/**
 * POST /api/messages
 *
 * Request body:
 * {
 *   channelId: string,
 *   content: string,
 *   type?: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO',
 *   parentId?: string (for thread replies)
 * }
 *
 * Response:
 * {
 *   id, content, type, createdAt,
 *   user: { id, username, displayName, avatarUrl },
 *   channelId
 * }
 */
export async function POST(request: NextRequest) {
  // Parse body first to get channelId
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = createMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { channelId, content, type, parentId } = parseResult.data;

  // Check authentication and channel access
  const authResult = await requireChannelMember(channelId);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // If this is a reply, verify parent message exists in same channel
  if (parentId) {
    const parentMessage = await prisma.message.findUnique({
      where: { id: parentId },
      select: { channelId: true, isDeleted: true },
    });

    if (!parentMessage) {
      return notFoundResponse('Parent message');
    }

    if (parentMessage.channelId !== channelId) {
      return successResponse(
        { error: 'Parent message is not in this channel' },
        400
      );
    }

    if (parentMessage.isDeleted) {
      return successResponse(
        { error: 'Cannot reply to a deleted message' },
        400
      );
    }
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      channelId,
      userId,
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
    },
  });

  // TODO: Emit Socket.io event "message:new"
  // io.to(channelId).emit('message:new', {
  //   channelId,
  //   message: { ...message }
  // });

  return createdResponse({
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    parentId: message.parentId,
    user: {
      id: message.user.id,
      username: message.user.username,
      displayName: message.user.displayName,
      avatarUrl: message.user.avatarUrl,
    },
  });
}
