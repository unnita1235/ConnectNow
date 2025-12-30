/**
 * User Presence API Routes
 * =============================================================================
 * GET   /api/users/presence - Get online users
 * PATCH /api/users/presence - Update own presence status
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  successResponse,
  validationErrorResponse,
} from '@/lib/api-utils';
import { updatePresenceSchema, presenceQuerySchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

/**
 * GET /api/users/presence
 *
 * Get online/active users, optionally filtered by workspace.
 *
 * Query params:
 * - workspaceId (optional): Filter by workspace members
 * - status (optional): Filter by specific status
 *
 * Response:
 * {
 *   users: [
 *     {
 *       id, username, displayName, avatarUrl,
 *       status, statusText, lastActiveAt
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const parseResult = presenceQuerySchema.safeParse({
    workspaceId: searchParams.get('workspaceId'),
    status: searchParams.get('status'),
  });

  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { workspaceId, status } = parseResult.data;

  // Build query
  let userFilter = {};

  if (workspaceId) {
    // Verify user is member of workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      return successResponse(
        { error: 'You are not a member of this workspace' },
        403
      );
    }

    // Get workspace members
    userFilter = {
      workspaceMemberships: {
        some: { workspaceId },
      },
    };
  }

  // Get users with presence
  const users = await prisma.user.findMany({
    where: {
      ...userFilter,
      isActive: true,
      presence: status
        ? { status }
        : { status: { in: ['ONLINE', 'AWAY', 'BUSY'] } },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      presence: {
        select: {
          status: true,
          statusText: true,
          lastActiveAt: true,
        },
      },
    },
    orderBy: [
      { presence: { status: 'asc' } },
      { username: 'asc' },
    ],
    take: 100, // Limit results
  });

  const formattedUsers = users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.presence?.status || 'OFFLINE',
    statusText: user.presence?.statusText,
    lastActiveAt: user.presence?.lastActiveAt,
  }));

  return successResponse({ users: formattedUsers });
}

/**
 * PATCH /api/users/presence
 *
 * Update own presence status.
 *
 * Request body:
 * {
 *   status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE',
 *   statusText?: string
 * }
 */
export async function PATCH(request: NextRequest) {
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

  const parseResult = updatePresenceSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { status, statusText } = parseResult.data;

  // Update or create presence
  const presence = await prisma.userPresence.upsert({
    where: { userId },
    update: {
      status,
      statusText: statusText ?? null,
      lastActiveAt: new Date(),
    },
    create: {
      userId,
      status,
      statusText: statusText ?? null,
      lastActiveAt: new Date(),
    },
  });

  // TODO: Broadcast presence change via Socket.io
  // io.emit('presence:changed', {
  //   userId,
  //   status: presence.status,
  //   statusText: presence.statusText,
  // });

  return successResponse({
    status: presence.status,
    statusText: presence.statusText,
    lastActiveAt: presence.lastActiveAt,
  });
}
