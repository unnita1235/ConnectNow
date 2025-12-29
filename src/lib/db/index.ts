import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Creates a PrismaClient instance with appropriate logging.
 * Returns null if DATABASE_URL is not configured.
 */
function createPrismaClient(): PrismaClient | null {
  // Don't crash if DATABASE_URL is missing - return null instead
  if (!process.env.DATABASE_URL) {
    console.warn(
      '⚠️  DATABASE_URL is not set. Database operations will fail at runtime.'
    );
    return null;
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

// Lazy initialization - only create client when DATABASE_URL is available
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createPrismaClient();
    if (!client) {
      // Create a proxy that throws helpful errors when used without DATABASE_URL
      return new Proxy({} as PrismaClient, {
        get(_, prop) {
          if (prop === 'then') return undefined; // Support async/await checks
          throw new Error(
            `Database not configured. Set DATABASE_URL environment variable. Attempted to access: ${String(prop)}`
          );
        },
      });
    }
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

// Export a getter that lazily initializes the client
export const prisma = getPrismaClient();

// Preserve singleton in development
if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
  globalForPrisma.prisma = prisma;
}

/**
 * Check if database is configured and accessible.
 * Use this to provide graceful degradation when DB is not available.
 */
export async function isDatabaseConnected(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if DATABASE_URL is configured (without testing connection).
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export default prisma;
