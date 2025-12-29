import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(80, 'Channel name must be 80 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  description: z.string().max(1000).optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'ANNOUNCEMENT']).default('PUBLIC'),
});

export const updateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'ANNOUNCEMENT']).optional(),
});

export const channelIdSchema = z.object({
  channelId: z.string().cuid(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
