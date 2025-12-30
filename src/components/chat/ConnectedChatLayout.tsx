/**
 * Connected Chat Layout Component
 * =============================================================================
 * Main layout that connects to real backend APIs
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
  SidebarInset,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronDown,
  Hash,
  Volume2,
  Megaphone,
  Plus,
  Settings,
  LogOut,
  MessageSquare,
  Users,
  Lock,
} from 'lucide-react';
import { ConnectedChatView } from './ConnectedChatView';
import { AddChannelDialog } from '../add-channel-dialog';
import { useWorkspaces, useChannels, type Channel } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

export function ConnectedChatLayout() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isAddChannelDialogOpen, setIsAddChannelDialogOpen] = useState(false);

  // Fetch workspaces
  const { workspaces, isLoading: loadingWorkspaces } = useWorkspaces();

  // Select first workspace by default
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  // Fetch channels for selected workspace
  const { channels, isLoading: loadingChannels, createChannel } = useChannels(selectedWorkspaceId);

  // Select first channel by default
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  // Get current workspace
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId]
  );

  // Handle channel creation
  const handleCreateChannel = async (name: string) => {
    const newChannel = await createChannel({ name });
    if (newChannel) {
      setSelectedChannel(newChannel);
    }
    setIsAddChannelDialogOpen(false);
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  // Loading state
  if (status === 'loading' || loadingWorkspaces) {
    return (
      <div className="flex h-screen">
        <div className="w-64 border-r p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // No workspaces
  if (workspaces.length === 0 && !loadingWorkspaces) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Welcome to ConnectNow!</h2>
          <p className="mt-2 text-muted-foreground">
            You're not a member of any workspaces yet. Create one to get started.
          </p>
          <button
            onClick={() => {/* Open create workspace dialog */}}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Workspace
          </button>
        </div>
      </div>
    );
  }

  const getChannelIcon = (type: Channel['type'], isPrivate: boolean) => {
    if (isPrivate) return <Lock className="h-4 w-4" />;
    switch (type) {
      case 'VOICE':
        return <Volume2 className="h-4 w-4" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon" className="group/sidebar" variant="sidebar">
        {/* Workspace header */}
        <SidebarHeader className="h-16 flex items-center p-4 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-between w-full group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-3">
                  {currentWorkspace?.iconUrl ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentWorkspace.iconUrl} />
                      <AvatarFallback>{currentWorkspace.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <MessageSquare className="h-8 w-8 text-primary shrink-0" />
                  )}
                  <span className="text-lg font-bold text-sidebar-foreground truncate">
                    {currentWorkspace?.name || 'ConnectNow'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {/* Workspace list */}
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => {
                    setSelectedWorkspaceId(workspace.id);
                    setSelectedChannel(null);
                  }}
                  className={cn(
                    workspace.id === selectedWorkspaceId && 'bg-accent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {workspace.iconUrl ? (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={workspace.iconUrl} />
                        <AvatarFallback className="text-xs">
                          {workspace.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs">
                        {workspace.name.charAt(0)}
                      </div>
                    )}
                    <span className="truncate">{workspace.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Workspace Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                Invite People
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <MessageSquare className="h-8 w-8 text-primary shrink-0 hidden group-data-[collapsible=icon]:block" />
        </SidebarHeader>

        {/* Channels */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Channels</span>
              <button
                onClick={() => setIsAddChannelDialogOpen(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </SidebarGroupLabel>
            <SidebarMenu>
              {loadingChannels ? (
                <div className="px-2 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  {channels.map((channel) => (
                    <SidebarMenuItem key={channel.id}>
                      <SidebarMenuButton
                        onClick={() => setSelectedChannel(channel)}
                        isActive={selectedChannel?.id === channel.id}
                        tooltip={channel.name}
                      >
                        {getChannelIcon(channel.type, channel.isPrivate)}
                        <span>{channel.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Add Channel"
                      onClick={() => setIsAddChannelDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Channel</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroup>

          {/* Direct Messages placeholder */}
          <SidebarGroup>
            <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Coming soon">
                  <Plus className="h-4 w-4" />
                  <span className="text-muted-foreground">Coming soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* User footer */}
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback>
                    {(session?.user?.name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold group-data-[collapsible=icon]:hidden text-sidebar-foreground truncate">
                  {session?.user?.name || 'User'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main content */}
      <SidebarInset>
        {selectedChannel && selectedWorkspaceId ? (
          <ConnectedChatView
            channel={selectedChannel}
            workspaceId={selectedWorkspaceId}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Hash className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Select a channel to start chatting</p>
            </div>
          </div>
        )}

        {/* Add channel dialog */}
        <AddChannelDialog
          open={isAddChannelDialogOpen}
          onOpenChange={setIsAddChannelDialogOpen}
          onCreateChannel={handleCreateChannel}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
