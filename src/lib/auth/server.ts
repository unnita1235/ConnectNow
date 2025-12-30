/**
 * Server-Side Authentication Helpers
 * =============================================================================
 * Functions for server-side authentication in API routes and server components.
 */

import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import { authOptions } from './config';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import type { SafeUser } from '@/lib/db-types';

/**
 * Get the current session from server context
 * Use this in Server Components and API Routes
 *
 * @example
 * // In a Server Component
 * const session = await getServerSession();
 * if (!session) redirect('/login');
 *
 * @example
 * // In an API Route
 * const session = await getServerSession();
 * if (!session) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

/**
 * Alias for getServerSession (shorter name)
 */
export const auth = getServerSession;

/**
 * Get the current user with full profile data from database
 * Returns null if not authenticated
 *
 * @example
 * const user = await getCurrentUser();
 * if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      emailVerified: true,
      emailVerifiedAt: true,
      isActive: true,
      isBanned: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });

  return user;
}

/**
 * Authentication context for API routes
 */
export type AuthContext = {
  userId: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

/**
 * Require authentication for an API route
 * Returns the auth context or throws an unauthorized response
 *
 * @example
 * export async function GET(req: NextRequest) {
 *   const authResult = await requireAuth();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId, user } = authResult;
 *   // ... rest of your handler
 * }
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in to access this resource' },
      { status: 401 }
    );
  }

  return {
    userId: session.user.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      displayName: session.user.displayName,
      avatarUrl: session.user.avatarUrl,
    },
  };
}

/**
 * Require user to be a member of a workspace
 *
 * @param workspaceId - The workspace ID to check
 * @returns Auth context with workspace member info, or error response
 *
 * @example
 * const result = await requireWorkspaceMember(workspaceId);
 * if (result instanceof NextResponse) return result;
 * const { userId, workspaceMember } = result;
 */
export async function requireWorkspaceMember(
  workspaceId: string
): Promise<
  | (AuthContext & { workspaceMember: { role: string; joinedAt: Date } })
  | NextResponse
> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { userId, user } = authResult;

  // Check workspace membership
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      role: true,
      joinedAt: true,
    },
  });

  if (!member) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You are not a member of this workspace' },
      { status: 403 }
    );
  }

  return {
    userId,
    user,
    workspaceMember: member,
  };
}

/**
 * Require user to be a member of a channel
 *
 * @param channelId - The channel ID to check
 * @returns Auth context with channel member info, or error response
 *
 * @example
 * const result = await requireChannelMember(channelId);
 * if (result instanceof NextResponse) return result;
 * const { userId, channelMember } = result;
 */
export async function requireChannelMember(
  channelId: string
): Promise<
  | (AuthContext & {
      channelMember: { role: string; isMuted: boolean; lastReadAt: Date | null };
      channel: { id: string; workspaceId: string; isPrivate: boolean };
    })
  | NextResponse
> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { userId, user } = authResult;

  // Get channel info
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      workspaceId: true,
      isPrivate: true,
    },
  });

  if (!channel) {
    return NextResponse.json(
      { error: 'Not Found', message: 'Channel not found' },
      { status: 404 }
    );
  }

  // For private channels, check direct membership
  if (channel.isPrivate) {
    const member = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      select: {
        role: true,
        isMuted: true,
        lastReadAt: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not a member of this channel' },
        { status: 403 }
      );
    }

    return {
      userId,
      user,
      channelMember: member,
      channel,
    };
  }

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
    return NextResponse.json(
      { error: 'Forbidden', message: 'You are not a member of this workspace' },
      { status: 403 }
    );
  }

  // Get or create channel membership for public channel
  let channelMember = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    select: {
      role: true,
      isMuted: true,
      lastReadAt: true,
    },
  });

  // Auto-join public channels
  if (!channelMember) {
    channelMember = await prisma.channelMember.create({
      data: {
        channelId,
        userId,
        role: 'MEMBER',
      },
      select: {
        role: true,
        isMuted: true,
        lastReadAt: true,
      },
    });
  }

  return {
    userId,
    user,
    channelMember,
    channel,
  };
}

/**
 * Check if user has a specific role in a workspace
 */
export async function hasWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: string[]
): Promise<boolean> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: { role: true },
  });

  return member ? roles.includes(member.role) : false;
}

/**
 * Check if user is workspace owner or admin
 */
export async function isWorkspaceAdmin(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  return hasWorkspaceRole(userId, workspaceId, ['OWNER', 'ADMIN']);
}

/**
 * Check if user is channel owner or moderator
 */
export async function isChannelModerator(
  userId: string,
  channelId: string
): Promise<boolean> {
  const member = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    select: { role: true },
  });

  return member ? ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role) : false;
}
