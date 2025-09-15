
"use client";

import React, { useState, useMemo } from 'react';
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Hash,
  Plus,
  Settings,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { ChatView } from './chat-view';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { channels, directMessages, currentUser } from '@/lib/data';
import type { Chat, Channel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AddChannelDialog } from './add-channel-dialog';

export function ChatLayout() {
  const [allChannels, setAllChannels] = useState(channels);
  const [allDMs] = useState(directMessages);
  const [selectedChat, setSelectedChat] = useState<Chat>(allChannels[0]);
  const [isAddChannelDialogOpen, setIsAddChannelDialogOpen] = useState(false);

  const chats = useMemo(() => {
    return [...allChannels, ...allDMs];
  }, [allChannels, allDMs]);

  const handleChatSelect = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      setSelectedChat(chat);
    }
  };
  
  const handleCreateChannel = (name: string) => {
    const newChannel: Channel = {
      id: `channel-${Date.now()}`,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      messages: [],
    };
    setAllChannels(prev => [...prev, newChannel]);
    setSelectedChat(newChannel);
    setIsAddChannelDialogOpen(false);
  };

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon" className="group/sidebar" variant="sidebar">
        <SidebarHeader className="h-16 flex items-center p-4 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-between w-full group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="size-8 text-primary shrink-0" />
                    <span className="text-lg font-bold text-sidebar-foreground">ConnectNow</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Workspace Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
           <MessageSquare className="size-8 text-primary shrink-0 hidden group-data-[collapsible=icon]:block" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
              <span>Channels</span>
            </SidebarGroupLabel>
            <SidebarMenu>
              {allChannels.map((channel) => (
                <SidebarMenuItem key={channel.id}>
                  <SidebarMenuButton
                    onClick={() => handleChatSelect(channel.id)}
                    isActive={selectedChat.id === channel.id}
                    tooltip={channel.name}
                    className={cn(channel.isUnread && "font-bold text-sidebar-foreground")}
                  >
                    <Hash />
                    <span>{channel.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Create Channel" onClick={() => setIsAddChannelDialogOpen(true)}>
                    <Plus />
                    <span>Add channels</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
            <SidebarMenu>
              {allDMs.map((dm) => {
                const otherUser = dm.participants.find(p => p.id !== currentUser.id)!;
                return (
                <SidebarMenuItem key={dm.id}>
                  <SidebarMenuButton
                    onClick={() => handleChatSelect(dm.id)}
                    isActive={selectedChat.id === dm.id}
                    tooltip={otherUser.name}
                    className={cn(dm.isUnread && "font-bold text-sidebar-foreground")}
                  >
                    <UserAvatarWithStatus user={otherUser} imageClassName="size-4" />
                    <span>{otherUser.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )})}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent w-full">
                    <UserAvatarWithStatus user={currentUser} imageClassName="size-8" />
                    <span className="font-semibold group-data-[collapsible=icon]:hidden text-sidebar-foreground">
                        {currentUser.name}
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                 <DropdownMenuItem>Profile</DropdownMenuItem>
                 <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <ChatView chat={selectedChat} />
        <AddChannelDialog open={isAddChannelDialogOpen} onOpenChange={setIsAddChannelDialogOpen} onCreateChannel={handleCreateChannel} />
      </SidebarInset>
    </SidebarProvider>
  );
}
