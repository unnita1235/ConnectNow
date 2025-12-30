/**
 * Message Input Component
 * =============================================================================
 * Chat message input with typing indicators and file upload support.
 */

'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Smile, X } from 'lucide-react';

interface MessageInputProps {
  /** Callback when message is sent */
  onSend: (content: string) => void;
  /** Callback when user starts typing */
  onTypingStart?: () => void;
  /** Callback when user stops typing */
  onTypingStop?: () => void;
  /** Callback when file is attached */
  onFileAttach?: (file: File) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum message length */
  maxLength?: number;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Message Input Component
 *
 * @example
 * <MessageInput
 *   onSend={(content) => sendMessage(channelId, content)}
 *   onTypingStart={() => startTyping(channelId)}
 *   onTypingStop={() => stopTyping(channelId)}
 *   placeholder="Message #general"
 * />
 */
export function MessageInput({
  onSend,
  onTypingStart,
  onTypingStop,
  onFileAttach,
  placeholder = 'Type a message...',
  disabled = false,
  className,
  maxLength = 4000,
  autoFocus = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTypingStop?.();
    }, 2000);
  }, [isTyping, onTypingStart, onTypingStop]);

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= maxLength) {
      setContent(newContent);
      adjustTextareaHeight();
      if (newContent.length > 0) {
        handleTyping();
      }
    }
  };

  // Handle send
  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent && !attachedFile) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    onTypingStop?.();

    // Send message
    onSend(trimmedContent);

    // Clear input
    setContent('');
    setAttachedFile(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Refocus
    textareaRef.current?.focus();
  }, [content, attachedFile, onSend, onTypingStop]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Cancel on Escape
    if (e.key === 'Escape') {
      setContent('');
      setAttachedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      onFileAttach?.(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Clear file
  const clearFile = () => {
    setAttachedFile(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  const canSend = content.trim().length > 0 || attachedFile !== null;
  const charCount = content.length;
  const showCharCount = charCount > maxLength * 0.8;

  return (
    <div className={cn('relative', className)}>
      {/* Attached file preview */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate flex-1">{attachedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(attachedFile.size / 1024).toFixed(1)} KB
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 bg-muted/50 rounded-lg p-2">
        {/* File upload button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'placeholder:text-muted-foreground/60'
          )}
        />

        {/* Emoji button (placeholder) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>

        {/* Send button */}
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={disabled || !canSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Character count */}
      {showCharCount && (
        <div className="absolute bottom-1 right-14 text-xs text-muted-foreground">
          <span className={cn(charCount >= maxLength && 'text-destructive')}>
            {charCount}
          </span>
          <span>/{maxLength}</span>
        </div>
      )}
    </div>
  );
}

export default MessageInput;
