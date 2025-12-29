import { NextResponse } from 'next/server';
import { isDatabaseConnected } from '@/lib/db';

export async function GET() {
  const dbConnected = await isDatabaseConnected();

  const status = {
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
    },
    environment: process.env.NODE_ENV || 'development',
  };

  // Return 503 only if database should be connected but isn't
  // In development without DATABASE_URL, this is expected
  const httpStatus = !process.env.DATABASE_URL || dbConnected ? 200 : 503;

  return NextResponse.json(status, { status: httpStatus });
}
