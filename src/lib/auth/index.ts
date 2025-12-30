/**
 * Auth Module Exports
 * =============================================================================
 * Central export for all authentication utilities.
 */

// Re-export configuration
export { authOptions } from './config';

// Re-export password utilities
export {
  hashPassword,
  verifyPassword,
  generateSalt,
  validatePassword,
  validatePasswordFull,
  isCommonPassword,
  PASSWORD_REQUIREMENTS,
} from './password';

// Re-export server-side helpers
export {
  auth,
  getServerSession,
  getCurrentUser,
  requireAuth,
  requireWorkspaceMember,
  requireChannelMember,
} from './server';
