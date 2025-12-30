/**
 * Prisma Client Singleton
 * =============================================================================
 * This module provides a singleton instance of the Prisma Client to prevent
 * multiple instances during hot reloading in development.
 *
 * Usage:
 * import { prisma } from '@/lib/prisma';
 *
 * const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';

// Extend the global type to include prisma
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client instance with logging configuration
 * - In development: Log queries, errors, and warnings
 * - In production: Log errors only
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
};

/**
 * Global Prisma Client instance
 *
 * In development, we store the client on globalThis to prevent
 * creating multiple instances during hot module replacement (HMR).
 *
 * In production, we always create a fresh instance.
 */
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Only cache the client in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Disconnect Prisma Client
 * Call this when shutting down the application
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Health check for database connection
 * Returns true if database is accessible
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Transaction helper with automatic retry on deadlock
 * @param fn - Transaction function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is a deadlock or connection issue
      const isRetryable =
        lastError.message.includes('deadlock') ||
        lastError.message.includes('connection') ||
        lastError.message.includes('timeout');

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt), 3000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export default prisma;
