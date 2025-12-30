/**
 * NextAuth Session Provider
 * =============================================================================
 * Wraps the application with NextAuth's SessionProvider for client-side auth.
 */

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import type { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

/**
 * Session provider wrapper
 * Add this to your root layout to enable useSession/useAuth hooks
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SessionProvider>
 *           {children}
 *         </SessionProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      session={session}
      // Refetch session every 5 minutes
      refetchInterval={5 * 60}
      // Refetch session when window gains focus
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}

export default SessionProvider;
