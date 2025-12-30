/**
 * NextAuth.js Configuration
 * =============================================================================
 * Central configuration for authentication.
 * Supports email/password with JWT sessions.
 */

import type { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from './password';
import { loginSchema } from '@/lib/validations/auth';
import { UserStatus } from '@prisma/client';

/**
 * Extend NextAuth types to include our custom fields
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      status: UserStatus;
    };
  }

  interface User {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }
}

/**
 * NextAuth configuration options
 */
export const authOptions: NextAuthOptions = {
  // Use JWT for session management (stateless, scalable)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - refresh token every day
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Pages configuration
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login', // Error code passed in query string as ?error=
    newUser: '/channels', // Redirect after first login
  },

  // Authentication providers
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials): Promise<NextAuthUser | null> {
        try {
          // Validate input
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            console.error('Login validation failed:', parsed.error);
            return null;
          }

          const { email, password } = parsed.data;

          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              passwordHash: true,
              isActive: true,
              isBanned: true,
              emailVerified: true,
            },
          });

          // User not found
          if (!user) {
            console.log(`Login attempt failed: user not found for email ${email}`);
            return null;
          }

          // Check if user is active
          if (!user.isActive) {
            console.log(`Login attempt failed: user ${email} is deactivated`);
            return null;
          }

          // Check if user is banned
          if (user.isBanned) {
            console.log(`Login attempt failed: user ${email} is banned`);
            return null;
          }

          // Verify password
          const isValidPassword = await verifyPassword(password, user.passwordHash);
          if (!isValidPassword) {
            console.log(`Login attempt failed: invalid password for ${email}`);
            return null;
          }

          // Update last login timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // Update presence to online
          await prisma.userPresence.upsert({
            where: { userId: user.id },
            update: {
              status: 'ONLINE',
              lastActiveAt: new Date(),
            },
            create: {
              userId: user.id,
              status: 'ONLINE',
              lastActiveAt: new Date(),
            },
          });

          console.log(`User ${email} logged in successfully`);

          // Return user without password
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          };
        } catch (error) {
          console.error('Error in authorize:', error);
          return null;
        }
      },
    }),

    // TODO: Add OAuth providers (Google, GitHub, Discord)
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // }),
  ],

  // Callbacks for customizing JWT and session
  callbacks: {
    /**
     * JWT callback - called when JWT is created or updated
     */
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.displayName = user.displayName;
        token.avatarUrl = user.avatarUrl;
      }

      // Handle session update (e.g., after profile change)
      if (trigger === 'update' && session) {
        if (session.displayName !== undefined) {
          token.displayName = session.displayName;
        }
        if (session.avatarUrl !== undefined) {
          token.avatarUrl = session.avatarUrl;
        }
      }

      return token;
    },

    /**
     * Session callback - called when session is checked
     */
    async session({ session, token }) {
      // Add user data from token to session
      if (token) {
        session.user = {
          id: token.id,
          email: token.email,
          username: token.username,
          displayName: token.displayName,
          avatarUrl: token.avatarUrl,
          status: UserStatus.ONLINE, // Will be fetched from presence if needed
        };
      }

      return session;
    },

    /**
     * Sign in callback - called when user signs in
     */
    async signIn({ user }) {
      // Could add additional checks here (e.g., email verification requirement)
      if (!user) {
        return false;
      }

      return true;
    },

    /**
     * Redirect callback - called when user is redirected
     */
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Allow same origin URLs
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Default to channels page
      return `${baseUrl}/channels`;
    },
  },

  // Events for logging/analytics
  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user.email}`);
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`);

      // Update presence to offline
      if (token?.id) {
        await prisma.userPresence.update({
          where: { userId: token.id },
          data: {
            status: 'OFFLINE',
            lastActiveAt: new Date(),
          },
        }).catch((err) => {
          console.error('Failed to update presence on signOut:', err);
        });
      }
    },
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Secret for JWT signing
  secret: process.env.NEXTAUTH_SECRET,
};
