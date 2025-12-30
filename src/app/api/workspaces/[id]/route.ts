/**
 * Single Workspace API Routes
 * =============================================================================
 * GET    /api/workspaces/[id] - Get workspace details
 * PATCH  /api/workspaces/[id] - Update workspace
 * DELETE /api/workspaces/[id] - Delete workspace
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireWorkspaceMember, isWorkspaceAdmin } from '@/lib/auth/server';
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api-utils';
import { updateWorkspaceSchema } from '@/lib/validations/api';

// TODO: Rate limit - 100 req/min per user

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspaces/[id]
 *
 * Get workspace details.
 *
 * Response:
 * {
 *   id, name, slug, description, iconUrl, isPublic,
 *   owner: { id, username, displayName },
 *   _count: { members, channels },
 *   createdAt
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;

  // Check authentication and membership
  const authResult = await requireWorkspaceMember(workspaceId);
  if (authResult instanceof Response) return authResult;

  // Get workspace details
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          members: true,
          channels: true,
        },
      },
    },
  });

  if (!workspace) {
    return notFoundResponse('Workspace');
  }

  return successResponse({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    iconUrl: workspace.iconUrl,
    isPublic: workspace.isPublic,
    inviteCode: workspace.inviteCode,
    owner: workspace.owner,
    _count: workspace._count,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  });
}

/**
 * PATCH /api/workspaces/[id]
 *
 * Update workspace settings. Requires admin role.
 *
 * Request body:
 * {
 *   name?: string,
 *   description?: string,
 *   iconUrl?: string,
 *   isPublic?: boolean
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Check admin permission
  const isAdmin = await isWorkspaceAdmin(userId, workspaceId);
  if (!isAdmin) {
    return forbiddenResponse('Only workspace admins can update settings');
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return successResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = updateWorkspaceSchema.safeParse(body);
  if (!parseResult.success) {
    return validationErrorResponse(parseResult.error);
  }

  const { name, description, iconUrl, isPublic } = parseResult.data;

  // Update workspace
  const updatedWorkspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(iconUrl !== undefined && { iconUrl: iconUrl || null }),
      ...(isPublic !== undefined && { isPublic }),
    },
    include: {
      _count: {
        select: {
          members: true,
          channels: true,
        },
      },
    },
  });

  return successResponse(updatedWorkspace);
}

/**
 * DELETE /api/workspaces/[id]
 *
 * Delete a workspace. Only the owner can delete.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;

  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) {
    return notFoundResponse('Workspace');
  }

  // Only owner can delete
  if (workspace.ownerId !== userId) {
    return forbiddenResponse('Only the workspace owner can delete the workspace');
  }

  // Delete workspace (cascades to members, channels, messages)
  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  return noContentResponse();
}
