/**
 * Auth Validation Tests
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from '../auth';

describe('loginSchema', () => {
  it('should validate correct email login', () => {
    const result = loginSchema.safeParse({
      identifier: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should validate correct username login', () => {
    const result = loginSchema.safeParse({
      identifier: 'testuser',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty identifier', () => {
    const result = loginSchema.safeParse({
      identifier: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = loginSchema.safeParse({
      identifier: 'test@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('should validate correct signup data', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
      displayName: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = signupSchema.safeParse({
      email: 'invalid-email',
      username: 'testuser',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short username', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      username: 'ab',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject username with invalid characters', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      username: 'test user!',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject weak password', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'weakpass',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional displayName', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(true);
  });
});
