/**
 * useSocket Hook
 * =============================================================================
 * Client-side Socket.IO hook for real-time messaging.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketMessage,
  SocketDirectMessage,
  UserPresenceData,
} from '@/lib/socket/types';

// =============================================================================
// TYPES
// =============================================================================

type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface UseSocketOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Reconnection attempts (default: 5) */
  reconnectionAttempts?: number;
  /** Reconnection delay in ms (default: 1000) */
  reconnectionDelay?: number;
}

export interface UseSocketReturn {
  /** Socket connection status */
  isConnected: boolean;
  /** Whether socket is authenticated */
  isAuthenticated: boolean;
  /** Connection error message */
  error: string | null;
  /** Connect to socket server */
  connect: () => void;
  /** Disconnect from socket server */
  disconnect: () => void;
  /** Join a channel room */
  joinChannel: (channelId: string) => void;
  /** Leave a channel room */
  leaveChannel: (channelId: string) => void;
  /** Send a message to a channel */
  sendMessage: (
    channelId: string,
    content: string,
    options?: { type?: string; parentId?: string; tempId?: string }
  ) => void;
  /** Edit a message */
  editMessage: (messageId: string, content: string) => void;
  /** Delete a message */
  deleteMessage: (messageId: string) => void;
  /** Start typing indicator */
  startTyping: (channelId: string) => void;
  /** Stop typing indicator */
  stopTyping: (channelId: string) => void;
  /** Add reaction to a message */
  addReaction: (messageId: string, emoji: string) => void;
  /** Remove reaction from a message */
  removeReaction: (messageId: string, emoji: string) => void;
  /** Send a direct message */
  sendDirectMessage: (
    recipientId: string,
    content: string,
    options?: { type?: string; tempId?: string }
  ) => void;
  /** Mark DM conversation as read */
  markDmRead: (conversationId: string) => void;
  /** Update presence status */
  updatePresence: (status: string, statusText?: string) => void;
  /** Subscribe to an event */
  on: <K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => void;
  /** Unsubscribe from an event */
  off: <K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => void;
}

// =============================================================================
// SOCKET URL
// =============================================================================

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';

// =============================================================================
// HOOK
// =============================================================================

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, reconnectionAttempts = 5, reconnectionDelay = 1000 } = options;

  const { data: session, status } = useSession();
  const socketRef = useRef<SocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create socket instance
  const getSocket = useCallback((): SocketClient | null => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts,
        reconnectionDelay,
        reconnectionDelayMax: 5000,
        transports: ['websocket', 'polling'],
      });
    }
    return socketRef.current;
  }, [reconnectionAttempts, reconnectionDelay]);

  // Connect to socket server
  const connect = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;

    if (!socket.connected) {
      socket.connect();
    }
  }, [getSocket]);

  // Disconnect from socket server
  const disconnect = useCallback(() => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('auth:logout');
      socket.disconnect();
    }
    setIsConnected(false);
    setIsAuthenticated(false);
  }, [getSocket]);

  // Join channel
  const joinChannel = useCallback((channelId: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('channel:join', { channelId });
    }
  }, [getSocket, isAuthenticated]);

  // Leave channel
  const leaveChannel = useCallback((channelId: string) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('channel:leave', { channelId });
    }
  }, [getSocket]);

  // Send message
  const sendMessage = useCallback((
    channelId: string,
    content: string,
    options?: { type?: string; parentId?: string; tempId?: string }
  ) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('message:send', {
        channelId,
        content,
        type: options?.type as any,
        parentId: options?.parentId,
        tempId: options?.tempId,
      });
    }
  }, [getSocket, isAuthenticated]);

  // Edit message
  const editMessage = useCallback((messageId: string, content: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('message:edit', { messageId, content });
    }
  }, [getSocket, isAuthenticated]);

  // Delete message
  const deleteMessage = useCallback((messageId: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('message:delete', { messageId });
    }
  }, [getSocket, isAuthenticated]);

  // Typing indicators
  const startTyping = useCallback((channelId: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('typing:start', { channelId });
    }
  }, [getSocket, isAuthenticated]);

  const stopTyping = useCallback((channelId: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('typing:stop', { channelId });
    }
  }, [getSocket, isAuthenticated]);

  // Reactions
  const addReaction = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('reaction:add', { messageId, emoji });
    }
  }, [getSocket, isAuthenticated]);

  const removeReaction = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('reaction:remove', { messageId, emoji });
    }
  }, [getSocket, isAuthenticated]);

  // Direct messages
  const sendDirectMessage = useCallback((
    recipientId: string,
    content: string,
    options?: { type?: string; tempId?: string }
  ) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('dm:send', {
        recipientId,
        content,
        type: options?.type as any,
        tempId: options?.tempId,
      });
    }
  }, [getSocket, isAuthenticated]);

  const markDmRead = useCallback((conversationId: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('dm:read', { conversationId });
    }
  }, [getSocket, isAuthenticated]);

  // Presence
  const updatePresence = useCallback((status: string, statusText?: string) => {
    const socket = getSocket();
    if (socket?.connected && isAuthenticated) {
      socket.emit('presence:update', { status: status as any, statusText });
    }
  }, [getSocket, isAuthenticated]);

  // Event subscription
  const on = useCallback(<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => {
    const socket = getSocket();
    if (socket) {
      socket.on(event as string, callback as any);
    }
  }, [getSocket]);

  const off = useCallback(<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => {
    const socket = getSocket();
    if (socket) {
      socket.off(event as string, callback as any);
    }
  }, [getSocket]);

  // Setup socket event handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      setError(null);

      // Authenticate with session token
      // Note: In production, you'd use a proper socket auth token
      if (session?.user) {
        // For now, we'll use a simplified auth approach
        // The socket server would validate this token
        socket.emit('auth:login', { token: 'session-token' });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    };

    const handleConnectError = (err: Error) => {
      console.error('[Socket] Connection error:', err);
      setError(err.message);
    };

    const handleAuthSuccess = () => {
      console.log('[Socket] Authenticated');
      setIsAuthenticated(true);
      setError(null);
    };

    const handleAuthError = (data: { message: string }) => {
      console.error('[Socket] Auth error:', data.message);
      setError(data.message);
      setIsAuthenticated(false);
    };

    const handleError = (data: { message: string }) => {
      console.error('[Socket] Error:', data.message);
      setError(data.message);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('auth:success', handleAuthSuccess);
    socket.on('auth:error', handleAuthError);
    socket.on('error', handleError);

    // Auto-connect if enabled and session is ready
    if (autoConnect && status === 'authenticated') {
      connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('auth:success', handleAuthSuccess);
      socket.off('auth:error', handleAuthError);
      socket.off('error', handleError);
    };
  }, [getSocket, session, status, autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isAuthenticated,
    error,
    connect,
    disconnect,
    joinChannel,
    leaveChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    addReaction,
    removeReaction,
    sendDirectMessage,
    markDmRead,
    updatePresence,
    on,
    off,
  };
}

// =============================================================================
// SPECIALIZED HOOKS
// =============================================================================

/**
 * Hook for channel-specific socket events
 */
export function useChannelSocket(channelId: string | null) {
  const socket = useSocket();
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!channelId || !socket.isAuthenticated) return;

    // Join channel
    socket.joinChannel(channelId);

    // Handle new messages
    const handleNewMessage = (data: { channelId: string; message: SocketMessage }) => {
      if (data.channelId === channelId) {
        setMessages((prev) => [data.message, ...prev]);
      }
    };

    // Handle message updates
    const handleMessageUpdated = (data: { channelId: string; messageId: string; content: string; updatedAt: string }) => {
      if (data.channelId === channelId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, content: data.content, updatedAt: data.updatedAt, isEdited: true }
              : msg
          )
        );
      }
    };

    // Handle message deletions
    const handleMessageDeleted = (data: { channelId: string; messageId: string }) => {
      if (data.channelId === channelId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, isDeleted: true, content: '[This message has been deleted]' }
              : msg
          )
        );
      }
    };

    // Handle typing
    const handleTypingStarted = (data: { channelId: string; userId: string; username: string }) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) => new Map(prev).set(data.userId, data.username));
      }
    };

    const handleTypingStopped = (data: { channelId: string; userId: string }) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('typing:started', handleTypingStarted);
    socket.on('typing:stopped', handleTypingStopped);

    return () => {
      socket.leaveChannel(channelId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('typing:started', handleTypingStarted);
      socket.off('typing:stopped', handleTypingStopped);
    };
  }, [channelId, socket]);

  return {
    ...socket,
    messages,
    setMessages,
    typingUsers: Array.from(typingUsers.values()),
  };
}

/**
 * Hook for presence tracking
 */
export function usePresence() {
  const socket = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<Map<string, UserPresenceData>>(new Map());

  useEffect(() => {
    if (!socket.isConnected) return;

    const handlePresenceChanged = (data: UserPresenceData) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        if (data.status === 'OFFLINE') {
          next.delete(data.userId);
        } else {
          next.set(data.userId, data);
        }
        return next;
      });
    };

    const handlePresenceOnline = (data: { userId: string; username: string }) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          userId: data.userId,
          username: data.username,
          displayName: null,
          avatarUrl: null,
          status: 'ONLINE',
          lastActiveAt: new Date().toISOString(),
        });
        return next;
      });
    };

    const handlePresenceOffline = (data: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on('presence:changed', handlePresenceChanged);
    socket.on('presence:online', handlePresenceOnline);
    socket.on('presence:offline', handlePresenceOffline);

    return () => {
      socket.off('presence:changed', handlePresenceChanged);
      socket.off('presence:online', handlePresenceOnline);
      socket.off('presence:offline', handlePresenceOffline);
    };
  }, [socket]);

  return {
    onlineUsers: Array.from(onlineUsers.values()),
    isOnline: (userId: string) => onlineUsers.has(userId),
    updatePresence: socket.updatePresence,
  };
}

export default useSocket;
