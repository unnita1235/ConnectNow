/**
 * Message List Component
 * =============================================================================
 * Displays messages with real-time updates, reactions, and attachments
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { MoreHorizontal, Edit2, Trash2, Reply, SmilePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AttachmentPreview } from './AttachmentPreview';
import type { Message } from '@/hooks/useMessages';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

export function MessageList({
  messages,
  currentUserId,
  isLoading,
  hasMore,
  onLoadMore,
  onEdit,
  onDelete,
  onReact,
  onRemoveReaction,
  onReply,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const lastMessageCountRef = useRef(messages.length);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);

  const handleStartEdit = (message: Message) => {
    setEditingId(message.id);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim() && onEdit) {
      onEdit(editingId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'h:mm a');
  };

  const formatDateSeparator = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach((message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    const lastGroup = groupedMessages[groupedMessages.length - 1];

    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({ date, messages: [message] });
    }
  });

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center pb-4">
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Load older messages
            </Button>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium px-2">
                {formatDateSeparator(group.messages[0].createdAt)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Messages for this date */}
            <div className="space-y-1">
              {group.messages.map((message, index) => {
                const prevMessage = index > 0 ? group.messages[index - 1] : null;
                const isFirstInGroup =
                  !prevMessage ||
                  prevMessage.author.id !== message.author.id ||
                  new Date(message.createdAt).getTime() -
                    new Date(prevMessage.createdAt).getTime() >
                    5 * 60 * 1000; // 5 minutes

                const isOwnMessage = message.author.id === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'group flex gap-3 px-2 py-1 hover:bg-muted/50 rounded-md transition-colors',
                      !isFirstInGroup && 'pl-12'
                    )}
                  >
                    {/* Avatar */}
                    {isFirstInGroup && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={message.author.avatarUrl || undefined} />
                        <AvatarFallback>
                          {(message.author.displayName || message.author.username)
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Message content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      {isFirstInGroup && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {message.author.displayName || message.author.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(message.createdAt)}
                          </span>
                          {message.isEdited && (
                            <span className="text-xs text-muted-foreground">(edited)</span>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      {editingId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {message.content && (
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          )}

                          {/* Attachments */}
                          {message.attachments.length > 0 && (
                            <AttachmentPreview
                              attachments={message.attachments}
                              className="mt-2"
                            />
                          )}

                          {/* Reactions */}
                          {message.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {message.reactions.map((reaction) => (
                                <button
                                  key={reaction.emoji}
                                  onClick={() =>
                                    reaction.hasReacted
                                      ? onRemoveReaction?.(message.id, reaction.emoji)
                                      : onReact?.(message.id, reaction.emoji)
                                  }
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                                    reaction.hasReacted
                                      ? 'bg-primary/10 border-primary/30 text-primary'
                                      : 'bg-muted hover:bg-muted/80 border-transparent'
                                  )}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span>{reaction.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {editingId !== message.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
                        {/* Quick emoji reaction */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <SmilePlus className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="end">
                            <div className="flex gap-1">
                              {COMMON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => onReact?.(message.id, emoji)}
                                  className="p-1 hover:bg-muted rounded text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* More actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onReply?.(message.id)}>
                              <Reply className="mr-2 h-4 w-4" />
                              Reply
                            </DropdownMenuItem>
                            {isOwnMessage && (
                              <>
                                <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDelete?.(message.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Be the first to send a message in this channel!
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
