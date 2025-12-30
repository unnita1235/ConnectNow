/**
 * Signup Page
 * =============================================================================
 * /signup - New user registration page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { SignupForm } from '@/components/auth/SignupForm';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign Up - ConnectNow',
  description: 'Create a new ConnectNow account',
};

export default async function SignupPage() {
  // Redirect to channels if already logged in
  const session = await getServerSession();
  if (session) {
    redirect('/channels');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/50 px-4 py-8">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessageCircle className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold">ConnectNow</span>
      </Link>

      {/* Signup Form */}
      <SignupForm />

      {/* Footer */}
      <p className="mt-8 text-xs text-center text-muted-foreground">
        Real-time communication, reimagined.
      </p>
    </div>
  );
}
