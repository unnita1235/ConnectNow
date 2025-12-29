import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be 4000 characters or less'),
  type: z.enum(['TEXT', 'FILE', 'SYSTEM', 'REPLY']).default('TEXT'),
  parentId: z.string().cuid().optional(),
  fileIds: z.array(z.string().cuid()).optional(),
});

export const updateMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be 4000 characters or less'),
});

export const messageQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageQueryParams = z.infer<typeof messageQuerySchema>;
