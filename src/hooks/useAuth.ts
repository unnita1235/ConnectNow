/**
 * useAuth Hook
 * =============================================================================
 * Client-side authentication hook using NextAuth.js.
 * Provides session data, login/logout functions, and loading states.
 */

'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { UserStatus } from '@prisma/client';

/**
 * User data from session
 */
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
};

/**
 * Auth hook return type
 */
export type UseAuthReturn = {
  /** Current user data (null if not authenticated) */
  user: AuthUser | null;

  /** Whether the session is loading */
  isLoading: boolean;

  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Session status: 'loading' | 'authenticated' | 'unauthenticated' */
  status: 'loading' | 'authenticated' | 'unauthenticated';

  /** Sign in with email and password */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  /** Sign out the current user */
  logout: (callbackUrl?: string) => Promise<void>;

  /** Refresh the session */
  refresh: () => Promise<void>;

  /** Update session data (e.g., after profile change) */
  updateSession: (data: Partial<AuthUser>) => Promise<void>;
};

/**
 * Authentication hook for client components
 *
 * @example
 * function ProfileButton() {
 *   const { user, isLoading, logout } = useAuth();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!user) return <LoginButton />;
 *
 *   return (
 *     <div>
 *       <span>{user.displayName || user.username}</span>
 *       <button onClick={() => logout()}>Logout</button>
 *     </div>
 *   );
 * }
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  // Memoize user data
  const user = useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      displayName: session.user.displayName,
      avatarUrl: session.user.avatarUrl,
      status: session.user.status,
    };
  }, [session]);

  /**
   * Sign in with email and password
   */
  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          // Map error codes to user-friendly messages
          const errorMessages: Record<string, string> = {
            CredentialsSignin: 'Invalid email or password',
            Default: 'An error occurred. Please try again.',
          };

          return {
            success: false,
            error: errorMessages[result.error] || errorMessages.Default,
          };
        }

        if (result?.ok) {
          // Redirect to channels page
          router.push('/channels');
          router.refresh();
          return { success: true };
        }

        return { success: false, error: 'An unexpected error occurred' };
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error. Please check your connection.' };
      }
    },
    [router]
  );

  /**
   * Sign out the current user
   */
  const logout = useCallback(
    async (callbackUrl: string = '/login') => {
      await signOut({ callbackUrl, redirect: true });
    },
    []
  );

  /**
   * Refresh the session
   */
  const refresh = useCallback(async () => {
    await update();
  }, [update]);

  /**
   * Update session data
   */
  const updateSession = useCallback(
    async (data: Partial<AuthUser>) => {
      await update(data);
    },
    [update]
  );

  return {
    user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    status,
    login,
    logout,
    refresh,
    updateSession,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 *
 * @example
 * function ProtectedPage() {
 *   const { user, isLoading } = useRequireAuth();
 *
 *   if (isLoading) return <LoadingScreen />;
 *
 *   // At this point, user is guaranteed to be non-null
 *   return <Dashboard user={user} />;
 * }
 */
export function useRequireAuth(): UseAuthReturn & { user: AuthUser } {
  const router = useRouter();
  const auth = useAuth();

  // Redirect to login if not authenticated and not loading
  if (!auth.isLoading && !auth.isAuthenticated) {
    router.push('/login');
  }

  // TypeScript: user is guaranteed after redirect logic
  return auth as UseAuthReturn & { user: AuthUser };
}

/**
 * Hook to redirect authenticated users (e.g., from login page)
 *
 * @example
 * function LoginPage() {
 *   useRedirectIfAuthenticated('/channels');
 *   return <LoginForm />;
 * }
 */
export function useRedirectIfAuthenticated(redirectTo: string = '/channels'): void {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    router.push(redirectTo);
  }
}

export default useAuth;
