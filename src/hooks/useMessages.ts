/**
 * Messages Data Hooks
 * =============================================================================
 * Hooks for fetching and managing channel/DM messages with Socket.IO integration
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useChannelSocket } from './useSocket';

// Types
export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface Message {
  id: string;
  content: string;
  author: MessageAuthor;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  parentId: string | null;
  replyCount: number;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
}

export interface MessagesResponse {
  data: Message[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    total: number;
  };
}

interface UseMessagesOptions {
  channelId: string | null;
  limit?: number;
  enableRealtime?: boolean;
}

/**
 * Hook to fetch and manage channel messages with real-time updates
 */
export function useMessages({ channelId, limit = 50, enableRealtime = true }: UseMessagesOptions) {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Socket.IO integration
  const { isConnected, sendMessage: socketSendMessage } = useChannelSocket(
    enableRealtime && channelId ? channelId : null,
    {
      onMessage: (newMessage) => {
        // Add new message to list (avoid duplicates)
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMessage.id);
          if (exists) return prev;
          return [...prev, {
            id: newMessage.id,
            content: newMessage.content,
            author: newMessage.author,
            createdAt: newMessage.createdAt,
            updatedAt: newMessage.createdAt,
            isEdited: false,
            parentId: newMessage.parentId || null,
            replyCount: 0,
            attachments: newMessage.attachments || [],
            reactions: [],
          }];
        });
      },
      onMessageEdited: (data) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, content: data.content, isEdited: true, updatedAt: new Date().toISOString() }
              : m
          )
        );
      },
      onMessageDeleted: (data) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      },
    }
  );

  // Fetch messages
  const fetchMessages = useCallback(async (cursor?: string) => {
    if (status !== 'authenticated' || !channelId) {
      setIsLoading(false);
      return;
    }

    if (cursor) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(cursor && { cursor }),
      });

      const response = await fetch(`/api/channels/${channelId}/messages?${params}`);
      const data: MessagesResponse = await response.json();

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to fetch messages');
      }

      if (cursor) {
        // Prepend older messages
        setMessages((prev) => [...data.data.reverse(), ...prev]);
      } else {
        // Initial load - messages come newest first, we want oldest first for display
        setMessages(data.data.reverse());
      }

      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [channelId, limit, status]);

  // Initial fetch
  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    fetchMessages();
  }, [fetchMessages]);

  // Load more (older messages)
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchMessages(nextCursor);
    }
  }, [fetchMessages, hasMore, nextCursor, isLoadingMore]);

  // Send message
  const sendMessage = useCallback(async (content: string, attachmentIds?: string[]) => {
    if (!channelId) return null;

    // Optimistically add message
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content,
      author: {
        id: session?.user?.id || '',
        username: session?.user?.name || '',
        displayName: session?.user?.name || null,
        avatarUrl: session?.user?.image || null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      parentId: null,
      replyCount: 0,
      attachments: [],
      reactions: [],
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Try Socket.IO first for instant delivery
      if (isConnected) {
        socketSendMessage(content, attachmentIds);
      }

      // Also send via API for persistence
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, content, attachmentIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Replace temp message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data, reactions: [] } : m))
      );

      return data;
    } catch (err) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return null;
    }
  }, [channelId, session, isConnected, socketSendMessage]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit message');
      }

      // Update locally
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content, isEdited: true, updatedAt: new Date().toISOString() }
            : m
        )
      );

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit message');
      return null;
    }
  }, []);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete message');
      }

      // Remove locally
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
      return false;
    }
  }, []);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reaction');
      }

      // Update locally
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;

          const existingReaction = m.reactions.find((r) => r.emoji === emoji);
          if (existingReaction) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, hasReacted: true }
                  : r
              ),
            };
          } else {
            return {
              ...m,
              reactions: [
                ...m.reactions,
                { emoji, count: 1, users: [], hasReacted: true },
              ],
            };
          }
        })
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reaction');
      return false;
    }
  }, []);

  // Remove reaction
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove reaction');
      }

      // Update locally
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;

          return {
            ...m,
            reactions: m.reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, hasReacted: false }
                  : r
              )
              .filter((r) => r.count > 0),
          };
        })
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove reaction');
      return false;
    }
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    isConnected,
    refetch: () => fetchMessages(),
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  };
}

/**
 * Hook for direct messages
 */
export function useDirectMessages(conversationId: string | null) {
  const { status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchMessages = useCallback(async (cursor?: string) => {
    if (status !== 'authenticated' || !conversationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '50',
        ...(cursor && { cursor }),
      });

      const response = await fetch(`/api/direct-messages/${conversationId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch messages');
      }

      if (cursor) {
        setMessages((prev) => [...data.data.reverse(), ...prev]);
      } else {
        setMessages(data.data.reverse());
      }

      setHasMore(data.pagination?.hasMore || false);
      setNextCursor(data.pagination?.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, status]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    refetch: () => fetchMessages(),
    loadMore: () => nextCursor && fetchMessages(nextCursor),
  };
}
