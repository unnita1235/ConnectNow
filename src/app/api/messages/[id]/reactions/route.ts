/**
 * Message Reactions API Routes
 * =============================================================================
 * POST   /api/messages/[id]/reactions - Add a reaction
 * DELETE /api/messages/[id]/reactions - Remove a reaction
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  createdResponse,
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api-utils';
import { createReactionSchema } from '@/lib/validations/api';

// TODO: Rate limit - 30 reactions/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/messages/[id]/reactions
 *
 * Request body:
 * {
 *   emoji: string
 * }
 *
 * Adds a reaction to the message. If user already reacted with same emoji,
 * returns 409 Conflict.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const parseResult = createReactionSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { emoji } = parseResult.data;

  // Get message and check access
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      channelId: true,
      isDeleted: true,
      channel: {
        select: {
          workspaceId: true,
          isPrivate: true,
        },
      },
    },
  });

  if (!message) {
    return notFoundResponse('Message');
  }

  if (message.isDeleted) {
    return successResponse({ error: 'Cannot react to a deleted message' }, 400);
  }

  // Check channel access
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

  // Check if reaction already exists
  const existingReaction = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji,
      },
    },
  });

  if (existingReaction) {
    return successResponse(
      { error: 'You have already reacted with this emoji' },
      409
    );
  }

  // Create reaction
  const reaction = await prisma.messageReaction.create({
    data: {
      messageId,
      userId,
      emoji,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // TODO: Emit Socket.io event "reaction:added"
  // io.to(message.channelId).emit('reaction:added', {
  //   channelId: message.channelId,
  //   messageId,
  //   reaction: {
  //     emoji,
  //     userId,
  //     username: reaction.user.username,
  //   },
  // });

  return createdResponse({
    id: reaction.id,
    emoji: reaction.emoji,
    messageId: reaction.messageId,
    user: {
      id: reaction.user.id,
      username: reaction.user.username,
      displayName: reaction.user.displayName,
    },
    createdAt: reaction.createdAt,
  });
}

/**
 * DELETE /api/messages/[id]/reactions
 *
 * Query params:
 * - emoji: string (required) - The emoji to remove
 *
 * Removes the current user's reaction with the specified emoji.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: messageId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get emoji from query params
  const emoji = request.nextUrl.searchParams.get('emoji');
  if (!emoji) {
    return successResponse({ error: 'Emoji query parameter is required' }, 400);
  }

  // Find and delete reaction
  const reaction = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji,
      },
    },
    select: {
      id: true,
      message: {
        select: {
          channelId: true,
        },
      },
    },
  });

  if (!reaction) {
    return notFoundResponse('Reaction');
  }

  await prisma.messageReaction.delete({
    where: { id: reaction.id },
  });

  // TODO: Emit Socket.io event "reaction:removed"
  // io.to(reaction.message.channelId).emit('reaction:removed', {
  //   channelId: reaction.message.channelId,
  //   messageId,
  //   reaction: {
  //     emoji,
  //     userId,
  //   },
  // });

  return noContentResponse();
}
