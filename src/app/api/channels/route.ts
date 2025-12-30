/**
 * Channels API Routes
 * =============================================================================
 * GET  /api/channels - List channels for authenticated user
 * POST /api/channels - Create a new channel
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  paginatedResponse,
} from '@/lib/api-utils';
import {
  createChannelSchema,
  paginationSchema,
  channelQuerySchema,
} from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

/**
 * GET /api/channels
 *
 * Query parameters:
 * - workspaceId (optional): Filter by workspace
 * - type (optional): Filter by channel type
 * - includeArchived (optional): Include archived channels
 * - page (default: 1): Page number
 * - limit (default: 50): Items per page
 *
 * Response:
 * {
 *   data: Channel[],
 *   pagination: { page, limit, total, totalPages, hasMore }
 * }
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const paginationResult = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  if (!paginationResult.success) {
    return validationErrorResponse(paginationResult.error);
  }

  const queryResult = channelQuerySchema.safeParse({
    workspaceId: searchParams.get('workspaceId'),
    type: searchParams.get('type'),
    includeArchived: searchParams.get('includeArchived'),
  });

  if (!queryResult.success) {
    return validationErrorResponse(queryResult.error);
  }

  const { page, limit } = paginationResult.data;
  const { workspaceId, type, includeArchived } = queryResult.data;
  const skip = (page - 1) * limit;

  // Build where clause
  const where = {
    // Only channels in workspaces the user is a member of
    workspace: {
      members: {
        some: { userId },
      },
    },
    // For private channels, user must be a member
    OR: [
      { isPrivate: false },
      { members: { some: { userId } } },
    ],
    ...(workspaceId && { workspaceId }),
    ...(type && { type }),
    ...(!includeArchived && { isArchived: false }),
  };

  // Get channels with count
  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      include: {
        _count: {
          select: { members: true, messages: true },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.channel.count({ where }),
  ]);

  return paginatedResponse(channels, total, page, limit);
}

/**
 * POST /api/channels
 *
 * Request body:
 * {
 *   workspaceId: string,
 *   name: string,
 *   description?: string,
 *   type?: 'TEXT' | 'VOICE' | 'FORUM',
 *   isPrivate?: boolean
 * }
 *
 * Response: Channel object with 201 status
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse and validate body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = createChannelSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { workspaceId, name, description, type, isPrivate } = parseResult.data;

  // Check user is a member of the workspace
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!workspaceMember) {
    return successResponse(
      { error: 'You are not a member of this workspace' },
      403
    );
  }

  // Check if channel name already exists in workspace
  const existingChannel = await prisma.channel.findUnique({
    where: {
      workspaceId_name: {
        workspaceId,
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

  // Get the next position for the channel
  const lastChannel = await prisma.channel.findFirst({
    where: { workspaceId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const position = (lastChannel?.position ?? -1) + 1;

  // Create channel in transaction
  const channel = await prisma.$transaction(async (tx) => {
    // Create the channel
    const newChannel = await tx.channel.create({
      data: {
        workspaceId,
        name: name.toLowerCase(),
        description,
        type,
        isPrivate,
        position,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    // Add creator as channel owner
    await tx.channelMember.create({
      data: {
        channelId: newChannel.id,
        userId,
        role: 'OWNER',
      },
    });

    return newChannel;
  });

  return createdResponse({
    ...channel,
    _count: { ...channel._count, members: 1 },
  });
}
