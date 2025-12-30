/**
 * Workspace Data Hooks
 * =============================================================================
 * Hooks for fetching and managing workspace data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Types
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  isPublic: boolean;
  inviteCode: string;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'GUEST';
  joinedAt: string;
  _count: {
    members: number;
    channels: number;
  };
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT';
  isPrivate: boolean;
  position: number;
  role?: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  _count?: {
    members: number;
    messages: number;
  };
}

export interface WorkspaceMember {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'GUEST';
  status?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
}

/**
 * Hook to fetch user's workspaces
 */
export function useWorkspaces() {
  const { data: session, status } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (status !== 'authenticated') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workspaces');
      }

      setWorkspaces(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const createWorkspace = async (data: {
    name: string;
    slug?: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Workspace | null> => {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create workspace');
      }

      // Refresh workspaces list
      await fetchWorkspaces();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  return {
    workspaces,
    isLoading,
    error,
    refetch: fetchWorkspaces,
    createWorkspace,
  };
}

/**
 * Hook to fetch single workspace details
 */
export function useWorkspace(workspaceId: string | null) {
  const { status } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (status !== 'authenticated' || !workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workspace');
      }

      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, status]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return {
    workspace,
    isLoading,
    error,
    refetch: fetchWorkspace,
  };
}

/**
 * Hook to fetch channels in a workspace
 */
export function useChannels(workspaceId: string | null) {
  const { status } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (status !== 'authenticated' || !workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels?workspaceId=${workspaceId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch channels');
      }

      setChannels(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, status]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const createChannel = async (data: {
    name: string;
    description?: string;
    type?: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT';
    isPrivate?: boolean;
  }): Promise<Channel | null> => {
    if (!workspaceId) return null;

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, workspaceId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create channel');
      }

      // Refresh channels list
      await fetchChannels();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  return {
    channels,
    isLoading,
    error,
    refetch: fetchChannels,
    createChannel,
  };
}

/**
 * Hook to fetch workspace members
 */
export function useWorkspaceMembers(workspaceId: string | null) {
  const { status } = useSession();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (status !== 'authenticated' || !workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      setMembers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, status]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
  };
}
