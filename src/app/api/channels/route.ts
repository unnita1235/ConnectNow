import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createChannelSchema } from '@/lib/validators/channel';

// GET /api/channels - List all channels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const cursor = searchParams.get('cursor');
    const type = searchParams.get('type');

    const channels = await prisma.channel.findMany({
      where: {
        archivedAt: null,
        ...(type && { type: type as 'PUBLIC' | 'PRIVATE' | 'ANNOUNCEMENT' }),
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

// POST /api/channels - Create a new channel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createChannelSchema.parse(body);

    // TODO: Get userId from session (NextAuth)
    const userId = 'user-1'; // Placeholder

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

    const channel = await prisma.channel.create({
      data: {
        name: validated.name,
        slug: validated.name,
        description: validated.description,
        type: validated.type,
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
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
