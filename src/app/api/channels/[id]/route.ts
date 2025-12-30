/**
 * Single Channel API Routes
 * =============================================================================
 * GET    /api/channels/[id] - Get channel details
 * PATCH  /api/channels/[id] - Update channel
 * DELETE /api/channels/[id] - Archive/delete channel
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
import { updateChannelSchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/channels/[id]
 *
 * Response:
 * {
 *   id, name, description, type, isPrivate,
 *   workspace: { id, name },
 *   members: [{ user: { id, username, avatarUrl }, role, joinedAt }],
 *   _count: { messages }
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: channelId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get channel with members
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      members: {
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
                  lastActiveAt: true,
                },
              },
            },
          },
        },
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' },
        ],
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  if (!channel) {
    return notFoundResponse('Channel');
  }

  // Check access
  if (channel.isPrivate) {
    const isMember = channel.members.some((m) => m.userId === userId);
    if (!isMember) {
      return forbiddenResponse('You are not a member of this private channel');
    }
  } else {
    // For public channels, check workspace membership
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
    });

    if (!workspaceMember) {
      return forbiddenResponse('You are not a member of this workspace');
    }
  }

  return successResponse(channel);
}

/**
 * PATCH /api/channels/[id]
 *
 * Request body:
 * {
 *   name?: string,
 *   description?: string,
 *   topic?: string,
 *   isPrivate?: boolean
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: channelId } = await params;

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

  const parseResult = updateChannelSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  // Check channel exists
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true, name: true },
  });

  if (!channel) {
    return notFoundResponse('Channel');
  }

  // Check user is channel moderator or workspace admin
  const isModerator = await isChannelModerator(userId, channelId);
  if (!isModerator) {
    return forbiddenResponse('You do not have permission to update this channel');
  }

  // Check for name conflict if name is being changed
  const { name, ...rest } = parseResult.data;
  if (name && name.toLowerCase() !== channel.name) {
    const existingChannel = await prisma.channel.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: channel.workspaceId,
          name: name.toLowerCase(),
        },
      },
    });

    if (existingChannel) {
      return successResponse(
        { error: 'A channel with this name already exists' },
        409
      );
    }
  }

  // Update channel
  const updatedChannel = await prisma.channel.update({
    where: { id: channelId },
    data: {
      ...(name && { name: name.toLowerCase() }),
      ...rest,
    },
    include: {
      _count: {
        select: { members: true, messages: true },
      },
    },
  });

  return successResponse(updatedChannel);
}

/**
 * DELETE /api/channels/[id]
 *
 * Archives the channel (soft delete)
 * Query: ?permanent=true to permanently delete
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: channelId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  // Check channel exists
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true },
  });

  if (!channel) {
    return notFoundResponse('Channel');
  }

  // Check user is channel owner or workspace owner
  const [channelMember, workspaceMember] = await Promise.all([
    prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      select: { role: true },
    }),
    prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
      select: { role: true },
    }),
  ]);

  const isOwner =
    channelMember?.role === 'OWNER' || workspaceMember?.role === 'OWNER';

  if (!isOwner) {
    return forbiddenResponse('Only channel or workspace owners can delete channels');
  }

  if (permanent) {
    // Permanently delete channel and all messages
    await prisma.channel.delete({
      where: { id: channelId },
    });
  } else {
    // Soft delete (archive)
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  return noContentResponse();
}
