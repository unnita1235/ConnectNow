/**
 * API Utilities
 * =============================================================================
 * Helper functions for API route handlers.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Success response with data
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Created response (201)
 */
export function createdResponse<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * No content response (204)
 */
export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Error response with message
 */
export function errorResponse(
  error: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error, ...(details && { details }) },
    { status }
  );
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Not found response (404)
 */
export function notFoundResponse(resource: string = 'Resource') {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

/**
 * Conflict response (409)
 */
export function conflictResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

/**
 * Validation error response (400)
 */
export function validationErrorResponse(error: z.ZodError) {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return NextResponse.json(
    { error: 'Validation failed', details },
    { status: 400 }
  );
}

/**
 * Internal server error response (500)
 */
export function serverErrorResponse(message: string = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      hasPrevious: page > 1,
    } satisfies PaginationMeta,
  });
}

// =============================================================================
// REQUEST PARSING HELPERS
// =============================================================================

/**
 * Parse JSON body with error handling
 */
export async function parseBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return { data: null, error: validationErrorResponse(result.error) };
    }

    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: errorResponse('Invalid JSON body'),
    };
  }
}

/**
 * Parse query parameters
 */
export function parseQuery<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): { data: z.infer<T>; error: null } | { data: null; error: NextResponse } {
  try {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
      return { data: null, error: validationErrorResponse(result.error) };
    }

    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: errorResponse('Invalid query parameters'),
    };
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Handle Prisma errors
 */
export function handlePrismaError(error: unknown): NextResponse {
  console.error('Database error:', error);

  if (error instanceof Error) {
    // Unique constraint violation
    if (error.message.includes('Unique constraint')) {
      return conflictResponse('Resource already exists');
    }

    // Foreign key constraint
    if (error.message.includes('Foreign key constraint')) {
      return errorResponse('Referenced resource not found');
    }

    // Record not found
    if (error.message.includes('Record to update not found')) {
      return notFoundResponse();
    }
  }

  return serverErrorResponse();
}

/**
 * Wrap async handler with error catching
 */
export function withErrorHandler(
  handler: (request: Request, context: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (request: Request, context: { params: Record<string, string> }) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API error:', error);
      return handlePrismaError(error);
    }
  };
}
