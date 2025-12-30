/**
 * API Validation Schemas
 * =============================================================================
 * Zod schemas for validating API request bodies and query parameters.
 */

import { z } from 'zod';
import { ChannelType, MessageType, MemberRole, UserStatus } from '@prisma/client';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Cursor-based pagination
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(['forward', 'backward']).default('backward'),
});

export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;

/**
 * CUID validation
 */
export const cuidSchema = z.string().min(1).max(30);

// =============================================================================
// WORKSPACE SCHEMAS
// =============================================================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500, 'Description too long').optional(),
  isPublic: z.boolean().default(false),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// =============================================================================
// CHANNEL SCHEMAS
// =============================================================================

export const createChannelSchema = z.object({
  workspaceId: cuidSchema,
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(100, 'Channel name too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Channel name can only contain letters, numbers, underscores, and hyphens'),
  description: z.string().max(500, 'Description too long').optional(),
  type: z.nativeEnum(ChannelType).default('TEXT'),
  isPrivate: z.boolean().default(false),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
  topic: z.string().max(250).optional(),
  isPrivate: z.boolean().optional(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

export const channelQuerySchema = z.object({
  workspaceId: cuidSchema.optional(),
  type: z.nativeEnum(ChannelType).optional(),
  includeArchived: z.coerce.boolean().default(false),
});

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

export const createMessageSchema = z.object({
  channelId: cuidSchema,
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  type: z.nativeEnum(MessageType).default('TEXT'),
  parentId: cuidSchema.optional(), // For thread replies
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
});

export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

export const messageQuerySchema = paginationSchema.extend({
  before: z.string().optional(), // Message ID to fetch messages before
  after: z.string().optional(), // Message ID to fetch messages after
  includeDeleted: z.coerce.boolean().default(false),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;

// =============================================================================
// REACTION SCHEMAS
// =============================================================================

export const createReactionSchema = z.object({
  emoji: z
    .string()
    .min(1, 'Emoji is required')
    .max(50, 'Emoji too long'),
});

export type CreateReactionInput = z.infer<typeof createReactionSchema>;

// =============================================================================
// DIRECT MESSAGE SCHEMAS
// =============================================================================

export const createDirectMessageSchema = z.object({
  recipientId: cuidSchema,
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  type: z.nativeEnum(MessageType).default('TEXT'),
});

export type CreateDirectMessageInput = z.infer<typeof createDirectMessageSchema>;

export const dmQuerySchema = paginationSchema.extend({
  before: z.string().optional(),
  after: z.string().optional(),
});

// =============================================================================
// USER SCHEMAS
// =============================================================================

export const updateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updatePresenceSchema = z.object({
  status: z.nativeEnum(UserStatus),
  statusText: z.string().max(100).optional(),
});

export type UpdatePresenceInput = z.infer<typeof updatePresenceSchema>;

export const presenceQuerySchema = z.object({
  workspaceId: cuidSchema.optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

// =============================================================================
// MEMBER SCHEMAS
// =============================================================================

export const addMemberSchema = z.object({
  userId: cuidSchema,
  role: z.nativeEnum(MemberRole).default('MEMBER'),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(MemberRole),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse and validate query parameters from URL
 */
export function parseQueryParams<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

/**
 * Format Zod errors for API response
 */
export function formatValidationError(error: z.ZodError): {
  error: string;
  details: Record<string, string[]>;
} {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return {
    error: 'Validation failed',
    details,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
