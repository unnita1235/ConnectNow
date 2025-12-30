/**
 * Single User API Routes
 * =============================================================================
 * GET   /api/users/[id] - Get user profile
 * PATCH /api/users/[id] - Update user profile (own profile only)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
} from '@/lib/api-utils';
import { updateUserSchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 *
 * Get a user's public profile.
 *
 * Response:
 * {
 *   id, username, displayName, avatarUrl, bio,
 *   status, lastActiveAt,
 *   createdAt
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: userId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;

  // Get user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      isActive: true,
      presence: {
        select: {
          status: true,
          statusText: true,
          lastActiveAt: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return notFoundResponse('User');
  }

  return successResponse({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    status: user.presence?.status || 'OFFLINE',
    statusText: user.presence?.statusText,
    lastActiveAt: user.presence?.lastActiveAt,
    createdAt: user.createdAt,
  });
}

/**
 * PATCH /api/users/[id]
 *
 * Update the current user's profile.
 * Can only update your own profile.
 *
 * Request body:
 * {
 *   displayName?: string,
 *   bio?: string,
 *   avatarUrl?: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: targetUserId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Can only update own profile
  if (targetUserId !== userId) {
    return forbiddenResponse('You can only update your own profile');
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = updateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { displayName, bio, avatarUrl } = parseResult.data;

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      updatedAt: true,
    },
  });

  return successResponse(updatedUser);
}
