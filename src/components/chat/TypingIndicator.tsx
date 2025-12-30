/**
 * Typing Indicator Component
 * =============================================================================
 * Shows who is currently typing in a channel.
 */

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  /** Array of usernames currently typing */
  typingUsers: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format typing users into a readable string
 */
function formatTypingMessage(users: string[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]} is typing`;
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing`;
  if (users.length === 3) return `${users[0]}, ${users[1]}, and ${users[2]} are typing`;
  return `${users[0]}, ${users[1]}, and ${users.length - 2} others are typing`;
}

/**
 * Animated typing dots
 */
function TypingDots() {
  return (
    <span className="inline-flex items-center space-x-0.5 ml-1">
      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
    </span>
  );
}

/**
 * Typing Indicator Component
 *
 * @example
 * <TypingIndicator typingUsers={['Alex', 'Jordan']} />
 */
export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  const message = useMemo(() => formatTypingMessage(typingUsers), [typingUsers]);

  if (typingUsers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center text-xs text-muted-foreground py-1 px-3',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <span>{message}</span>
      <TypingDots />
    </div>
  );
}

/**
 * Compact typing indicator (just dots)
 */
export function TypingDotsIndicator({ isTyping }: { isTyping: boolean }) {
  if (!isTyping) return null;

  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center space-x-1 px-3 py-1.5 bg-muted rounded-full">
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
      </div>
    </div>
  );
}

export default TypingIndicator;
