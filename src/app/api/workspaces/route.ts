/**
 * Workspaces API Routes
 * =============================================================================
 * GET  /api/workspaces - List user's workspaces
 * POST /api/workspaces - Create a new workspace
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/server';
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
} from '@/lib/api-utils';
import { createWorkspaceSchema, paginationSchema } from '@/lib/validations/api';

// TODO: Rate limit - 10 workspace creations per day per user

/**
 * GET /api/workspaces
 *
 * List all workspaces the current user is a member of.
 *
 * Response:
 * {
 *   data: [
 *     {
 *       id, name, slug, description, iconUrl,
 *       role, joinedAt,
 *       _count: { members, channels }
 *     }
 *   ]
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

  // Get user's workspaces
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              members: true,
              channels: true,
            },
          },
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
    skip,
    take: limit,
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    description: m.workspace.description,
    iconUrl: m.workspace.iconUrl,
    isPublic: m.workspace.isPublic,
    owner: m.workspace.owner,
    role: m.role,
    joinedAt: m.joinedAt,
    _count: m.workspace._count,
  }));

  return successResponse({ data: workspaces });
}

/**
 * POST /api/workspaces
 *
 * Create a new workspace.
 *
 * Request body:
 * {
 *   name: string,
 *   slug?: string,
 *   description?: string,
 *   isPublic?: boolean
 * }
 *
 * Response: Workspace object with 201 status
 */
export async function POST(request: NextRequest) {
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

  const parseResult = createWorkspaceSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { name, slug: providedSlug, description, isPublic } = parseResult.data;

  // Generate slug if not provided
  const slug =
    providedSlug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  // Check slug uniqueness
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (existingWorkspace) {
    return successResponse(
      { error: 'A workspace with this URL already exists' },
      409
    );
  }

  // Generate invite code
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  // Create workspace with owner membership and default channel
  const workspace = await prisma.$transaction(async (tx) => {
    // Create workspace
    const newWorkspace = await tx.workspace.create({
      data: {
        name,
        slug,
        description,
        isPublic,
        ownerId: userId,
        inviteCode,
      },
    });

    // Add owner as member
    await tx.workspaceMember.create({
      data: {
        workspaceId: newWorkspace.id,
        userId,
        role: 'OWNER',
      },
    });

    // Create default #general channel
    const channel = await tx.channel.create({
      data: {
        workspaceId: newWorkspace.id,
        name: 'general',
        description: 'General discussions',
        type: 'TEXT',
        isPrivate: false,
        position: 0,
      },
    });

    // Add owner to channel
    await tx.channelMember.create({
      data: {
        channelId: channel.id,
        userId,
        role: 'OWNER',
      },
    });

    return newWorkspace;
  });

  return createdResponse({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    iconUrl: workspace.iconUrl,
    isPublic: workspace.isPublic,
    inviteCode: workspace.inviteCode,
    createdAt: workspace.createdAt,
  });
}
