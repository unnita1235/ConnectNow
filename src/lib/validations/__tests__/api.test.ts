/**
 * API Validation Tests
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createChannelSchema,
  createMessageSchema,
  paginationSchema,
} from '../api';

describe('createWorkspaceSchema', () => {
  it('should validate correct workspace data', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'My Workspace',
      description: 'A test workspace',
      isPublic: true,
    });
    expect(result.success).toBe(true);
  });

  it('should validate with optional slug', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'My Workspace',
      slug: 'my-workspace',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short name', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'AB',
    });
    expect(result.success).toBe(false);
  });

  it('should reject long name', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'My Workspace',
      slug: 'Invalid Slug!',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateWorkspaceSchema', () => {
  it('should validate partial updates', () => {
    const result = updateWorkspaceSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('should validate empty update', () => {
    const result = updateWorkspaceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should allow clearing iconUrl', () => {
    const result = updateWorkspaceSchema.safeParse({
      iconUrl: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('createChannelSchema', () => {
  it('should validate correct channel data', () => {
    const result = createChannelSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'general',
      type: 'TEXT',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid channel name', () => {
    const result = createChannelSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Invalid Channel!',
    });
    expect(result.success).toBe(false);
  });

  it('should validate voice channel', () => {
    const result = createChannelSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'voice-chat',
      type: 'VOICE',
    });
    expect(result.success).toBe(true);
  });
});

describe('createMessageSchema', () => {
  it('should validate message with content', () => {
    const result = createMessageSchema.safeParse({
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Hello, world!',
    });
    expect(result.success).toBe(true);
  });

  it('should validate message with attachments only', () => {
    const result = createMessageSchema.safeParse({
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      content: '',
      attachmentIds: ['123e4567-e89b-12d3-a456-426614174000'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject message that is too long', () => {
    const result = createMessageSchema.safeParse({
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      content: 'A'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('should validate reply to parent', () => {
    const result = createMessageSchema.safeParse({
      channelId: '123e4567-e89b-12d3-a456-426614174000',
      content: 'This is a reply',
      parentId: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result.success).toBe(true);
  });
});

describe('paginationSchema', () => {
  it('should provide defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, limit: 20 });
  });

  it('should parse string numbers', () => {
    const result = paginationSchema.safeParse({
      page: '2',
      limit: '50',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 2, limit: 50 });
  });

  it('should cap limit at 100', () => {
    const result = paginationSchema.safeParse({
      limit: '200',
    });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBeLessThanOrEqual(100);
  });

  it('should reject page less than 1', () => {
    const result = paginationSchema.safeParse({
      page: '0',
    });
    expect(result.success).toBe(false);
  });
});
