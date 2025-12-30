/**
 * Auth Layout
 * =============================================================================
 * Layout for authentication pages (login, signup, forgot-password)
 * No sidebar, minimal navigation
 */

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      {children}
    </main>
  );
}
