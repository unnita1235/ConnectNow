/**
 * Authentication Validation Schemas
 * =============================================================================
 * Zod schemas for validating authentication-related requests.
 * These schemas are used both on the client (forms) and server (API routes).
 */

import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be at most 255 characters')
  .transform((email) => email.toLowerCase().trim());

/**
 * Username validation schema
 * - 3-30 characters
 * - Only alphanumeric and underscores
 * - Cannot start or end with underscore
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    'Username can only contain letters, numbers, and underscores (cannot start/end with underscore)'
  )
  .transform((username) => username.toLowerCase());

/**
 * Password validation schema
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Display name validation schema (optional)
 */
export const displayNameSchema = z
  .string()
  .min(1, 'Display name cannot be empty')
  .max(100, 'Display name must be at most 100 characters')
  .optional();

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Signup/Register request schema
 */
export const signupSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    displayName: displayNameSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Signup request schema (server-side, without confirmPassword)
 */
export const signupServerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export type SignupServerInput = z.infer<typeof signupServerSchema>;

/**
 * Password reset request schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Password reset confirmation schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Change password schema (for logged-in users)
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  displayName: z.string().max(100, 'Display name must be at most 100 characters').optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Helper function to format Zod errors for display
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

/**
 * Helper function to get first error message
 */
export function getFirstError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Validation error';
}
