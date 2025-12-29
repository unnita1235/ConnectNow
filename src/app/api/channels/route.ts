import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createChannelSchema } from '@/lib/validators/channel';
import { ChannelType, ChannelMemberRole, Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

// Valid channel types for query parameter validation
const channelTypeSchema = z.enum(['PUBLIC', 'PRIVATE', 'ANNOUNCEMENT']);

// Query parameters schema for GET request
const getChannelsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  type: channelTypeSchema.optional(),
});

/**
 * GET /api/channels - List all channels
 *
 * Query params:
 * - limit: number (1-100, default 20)
 * - cursor: string (cuid for pagination)
 * - type: 'PUBLIC' | 'PRIVATE' | 'ANNOUNCEMENT'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryResult = getChannelsQuerySchema.safeParse({
      limit: searchParams.get('limit') ?? 20,
      cursor: searchParams.get('cursor') ?? undefined,
      type: searchParams.get('type') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryResult.error.errors,
          validTypes: Object.values(ChannelType),
        },
        { status: 400 }
      );
    }

    const { limit, cursor, type } = queryResult.data;

    const channels = await prisma.channel.findMany({
      where: {
        archivedAt: null,
        ...(type && { type: type as ChannelType }),
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true, messages: true },
        },
      },
    });

    const hasMore = channels.length > limit;
    const items = hasMore ? channels.slice(0, limit) : channels;

    return NextResponse.json({
      channels: items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (error) {
    console.error('Failed to fetch channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/channels - Create a new channel
 *
 * Body:
 * - name: string (required, lowercase letters, numbers, hyphens only)
 * - description: string (optional)
 * - type: 'PUBLIC' | 'PRIVATE' | 'ANNOUNCEMENT' (default: PUBLIC)
 *
 * Note: This endpoint requires authentication. Currently uses a placeholder
 * user ID until NextAuth.js is fully integrated. In production, replace
 * with proper session handling.
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Integrate NextAuth.js for proper authentication
    // Example with NextAuth:
    // import { getServerSession } from 'next-auth/next';
    // import { authOptions } from '@/lib/auth';
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    // const userId = session.user.id;

    // Placeholder: In development, use a default user
    // In production, this MUST be replaced with proper auth
    const userId = process.env.NODE_ENV === 'development'
      ? 'user-1'
      : null;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Please configure NextAuth.js.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body using Zod
    const validationResult = createChannelSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    // Check if slug already exists
    const existing = await prisma.channel.findUnique({
      where: { slug: validated.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Channel with this name already exists' },
        { status: 409 }
      );
    }

    // Create channel with owner in a transaction for data consistency
    const channel = await prisma.$transaction(async (tx: TransactionClient) => {
      const newChannel = await tx.channel.create({
        data: {
          name: validated.name,
          slug: validated.name,
          description: validated.description,
          type: validated.type as ChannelType,
          createdById: userId,
        },
      });

      // Add creator as channel owner
      await tx.channelMember.create({
        data: {
          channelId: newChannel.id,
          userId,
          role: ChannelMemberRole.OWNER,
        },
      });

      // Return channel with members included
      return tx.channel.findUnique({
        where: { id: newChannel.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    // Type-safe Zod error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create channel:', error);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
}
