/**
 * Password Utilities
 * =============================================================================
 * Secure password hashing and verification using bcryptjs.
 *
 * Security notes:
 * - Uses bcrypt with cost factor of 12 (good balance of security/speed)
 * - Salt is automatically generated and stored in the hash
 * - Constant-time comparison prevents timing attacks
 */

import bcrypt from 'bcryptjs';

/**
 * Cost factor for bcrypt hashing.
 * 12 = ~250ms per hash (good security, reasonable speed)
 * Increase to 13-14 for higher security (but slower login)
 */
const SALT_ROUNDS = 12;

/**
 * Password validation requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional: set to true for stricter requirements
};

/**
 * Hash a plaintext password using bcrypt
 *
 * @param password - The plaintext password to hash
 * @returns Promise<string> - The bcrypt hash (includes salt)
 *
 * @example
 * const hash = await hashPassword('MySecurePass123');
 * // Store hash in database
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash
 *
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Promise<boolean> - True if password matches
 *
 * @example
 * const isValid = await verifyPassword('MySecurePass123', storedHash);
 * if (!isValid) throw new Error('Invalid password');
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random salt (for other cryptographic uses)
 * Note: bcrypt.hash() generates its own salt, so this is rarely needed
 *
 * @param rounds - Number of salt rounds (default: SALT_ROUNDS)
 * @returns Promise<string> - The generated salt
 */
export async function generateSalt(rounds: number = SALT_ROUNDS): Promise<string> {
  return bcrypt.genSalt(rounds);
}

/**
 * Validate password meets requirements
 *
 * @param password - The password to validate
 * @returns Object with isValid boolean and array of error messages
 *
 * @example
 * const { isValid, errors } = validatePassword('weak');
 * if (!isValid) {
 *   console.log(errors); // ['Password must be at least 8 characters']
 * }
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
} {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  } else {
    score += 1;
  }

  // Check maximum length
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be at most ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }

  // Check for uppercase
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }

  // Check for lowercase
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }

  // Check for number
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/[0-9]/.test(password)) {
    score += 1;
  }

  // Check for special characters (optional)
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  }

  // Bonus for length
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Determine strength
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score <= 2) strength = 'weak';
  else if (score <= 4) strength = 'fair';
  else if (score <= 5) strength = 'good';
  else strength = 'strong';

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Check if a password is commonly used (basic check)
 * In production, you might use a larger list or an API
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', 'qwerty',
  'abc123', 'monkey', 'master', 'dragon', 'letmein',
  'login', 'welcome', 'admin', 'passw0rd', 'Password1',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Full password validation including common password check
 */
export function validatePasswordFull(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
} {
  const result = validatePassword(password);

  if (isCommonPassword(password)) {
    result.errors.push('This password is too common. Please choose a more unique password.');
    result.isValid = false;
    result.strength = 'weak';
  }

  return result;
}
