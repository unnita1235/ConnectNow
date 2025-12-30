/**
 * User Registration API Route
 * =============================================================================
 * POST /api/auth/register
 *
 * Creates a new user account with email/password authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordFull } from '@/lib/auth/password';
import { signupServerSchema, formatZodErrors } from '@/lib/validations/auth';
import { z } from 'zod';

// TODO: Rate limit - 5 registrations per IP per hour

/**
 * POST /api/auth/register
 *
 * Request body:
 * {
 *   email: string,
 *   username: string,
 *   password: string,
 *   displayName?: string
 * }
 *
 * Response:
 * 201: { user: { id, email, username, displayName }, message: string }
 * 400: { error: string, details?: object }
 * 409: { error: string } // Email or username already exists
 * 500: { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const parseResult = signupServerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    const { email, username, password, displayName } = parseResult.data;

    // Validate password strength
    const passwordValidation = validatePasswordFull(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Password too weak',
          details: { password: passwordValidation.errors },
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          displayName: displayName || null,
          emailVerified: false, // TODO: Implement email verification
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      // Create presence record
      await tx.userPresence.create({
        data: {
          userId: newUser.id,
          status: 'OFFLINE',
        },
      });

      // Create a default workspace for the user
      const workspace = await tx.workspace.create({
        data: {
          name: `${username}'s Workspace`,
          slug: `${username}-workspace`,
          description: 'Your personal workspace',
          ownerId: newUser.id,
        },
      });

      // Add user as owner of the workspace
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: newUser.id,
          role: 'OWNER',
        },
      });

      // Create a general channel in the workspace
      const channel = await tx.channel.create({
        data: {
          workspaceId: workspace.id,
          name: 'general',
          description: 'General discussions',
          type: 'TEXT',
          isPrivate: false,
          position: 0,
        },
      });

      // Add user to the channel
      await tx.channelMember.create({
        data: {
          channelId: channel.id,
          userId: newUser.id,
          role: 'OWNER',
        },
      });

      return newUser;
    });

    console.log(`New user registered: ${email} (${user.id})`);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
        },
        message: 'Account created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    // Handle known Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Email or username already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
