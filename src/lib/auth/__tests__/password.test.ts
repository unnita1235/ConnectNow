/**
 * Password Utility Tests
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../password';

describe('hashPassword', () => {
  it('should hash a password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });

  it('should produce different hashes for same password', async () => {
    const password = 'SecurePass123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('should verify correct password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('should accept strong password', () => {
    const result = validatePasswordStrength('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it('should reject short password', () => {
    const result = validatePasswordStrength('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject password without uppercase', () => {
    const result = validatePasswordStrength('securepass123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject password without lowercase', () => {
    const result = validatePasswordStrength('SECUREPASS123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject password without number', () => {
    const result = validatePasswordStrength('SecurePass!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should calculate score correctly', () => {
    // Weak password (only lowercase)
    const weak = validatePasswordStrength('weakpass');
    expect(weak.score).toBeLessThan(3);

    // Strong password (all requirements + extra length)
    const strong = validatePasswordStrength('VerySecurePassword123!@#');
    expect(strong.score).toBe(5);
  });
});
