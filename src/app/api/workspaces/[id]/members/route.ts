/**
 * Workspace Members API Routes
 * =============================================================================
 * GET  /api/workspaces/[id]/members - List workspace members
 * POST /api/workspaces/[id]/members - Add a member to workspace
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceMember, isWorkspaceAdmin } from '@/lib/auth/server';
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  paginatedResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/api-utils';
import { addMemberSchema, paginationSchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspaces/[id]/members
 *
 * List all members of a workspace.
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 50)
 *
 * Response:
 * {
 *   data: [
 *     {
 *       id, role, joinedAt,
 *       user: { id, username, displayName, avatarUrl, status }
 *     }
 *   ],
 *   pagination: { ... }
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;

  // Check authentication and membership
  const authResult = await requireWorkspaceMember(workspaceId);
  if (authResult instanceof Response) return authResult;

  // Parse pagination
  const searchParams = request.nextUrl.searchParams;
  const parseResult = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { page, limit } = parseResult.data;
  const skip = (page - 1) * limit;

  // Get members
  const [members, total] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
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
                statusText: true,
                lastActiveAt: true,
              },
            },
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // Owner first, then admin, etc.
        { joinedAt: 'asc' },
      ],
      skip,
      take: limit,
    }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
  ]);

  const formattedMembers = members.map((m) => ({
    id: m.id,
    role: m.role,
    nickname: m.nickname,
    joinedAt: m.joinedAt,
    user: {
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      status: m.user.presence?.status || 'OFFLINE',
      statusText: m.user.presence?.statusText,
      lastActiveAt: m.user.presence?.lastActiveAt,
    },
  }));

  return paginatedResponse(formattedMembers, total, page, limit);
}

/**
 * POST /api/workspaces/[id]/members
 *
 * Add a member to the workspace. Requires admin role.
 *
 * Request body:
 * {
 *   userId: string,
 *   role?: 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'GUEST'
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;

  // Check authentication and membership
  const authResult = await requireWorkspaceMember(workspaceId);
  if (authResult instanceof Response) return authResult;
  const { userId: currentUserId } = authResult;

  // Check admin permission
  const isAdmin = await isWorkspaceAdmin(currentUserId, workspaceId);
  if (!isAdmin) {
    return forbiddenResponse('Only workspace admins can add members');
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = addMemberSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { userId, role } = parseResult.data;

  // Can't assign OWNER role through this endpoint
  if (role === 'OWNER') {
    return successResponse({ error: 'Cannot assign OWNER role' }, 400);
  }

  // Check user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, isBanned: true },
  });

  if (!user || !user.isActive || user.isBanned) {
    return notFoundResponse('User');
  }

  // Check if already a member
  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (existingMember) {
    return successResponse({ error: 'User is already a member' }, 409);
  }

  // Add member
  const member = await prisma.$transaction(async (tx) => {
    // Add to workspace
    const newMember = await tx.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
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

    // Add to all public channels
    const publicChannels = await tx.channel.findMany({
      where: {
        workspaceId,
        isPrivate: false,
        isArchived: false,
      },
      select: { id: true },
    });

    if (publicChannels.length > 0) {
      await tx.channelMember.createMany({
        data: publicChannels.map((channel) => ({
          channelId: channel.id,
          userId,
          role: 'MEMBER',
        })),
        skipDuplicates: true,
      });
    }

    return newMember;
  });

  return createdResponse({
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt,
    user: member.user,
  });
}
