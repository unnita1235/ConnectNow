/**
 * Login Page
 * =============================================================================
 * /login - User authentication page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { LoginForm } from '@/components/auth/LoginForm';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign In - ConnectNow',
  description: 'Sign in to your ConnectNow account',
};

export default async function LoginPage() {
  // Redirect to channels if already logged in
  const session = await getServerSession();
  if (session) {
    redirect('/channels');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/50 px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessageCircle className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold">ConnectNow</span>
      </Link>

      {/* Login Form */}
      <LoginForm />

      {/* Footer */}
      <p className="mt-8 text-xs text-center text-muted-foreground">
        Real-time communication, reimagined.
      </p>
    </div>
  );
}
