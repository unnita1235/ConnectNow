
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Hash, Paperclip, SendHorizontal, User, Users, Bell, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import type { Chat, Message } from '@/lib/types';
import { currentUser } from '@/lib/data';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getUrgency, summarizeNotifications } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatViewProps {
  chat: Chat;
}

export function ChatView({ chat }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [useSmartNotifications, setUseSmartNotifications] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setMessages(chat.messages);
  }, [chat]);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      author: currentUser,
      content: input,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    
    if (useSmartNotifications) {
      const { urgent, reason } = await getUrgency(newMessage, "Prioritize messages marked urgent or from senior members.");
      if (urgent) {
        toast({
          variant: "destructive",
          title: "Urgent Notification",
          description: `From ${newMessage.author.name}: ${reason}`,
        });
      }
    } else {
        toast({
            title: "New Message",
            description: `From ${newMessage.author.name}: ${newMessage.content.substring(0, 50)}...`,
        });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      author: currentUser,
      content: '',
      timestamp: new Date().toISOString(),
      file: {
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'other',
      }
    };

    setMessages(prev => [...prev, newMessage]);

    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleSummarize = async (preference: 'full' | 'summary') => {
    const unreadMessages = messages.slice(-5).map(m => `From ${m.author.name}: ${m.content}`);
    if (unreadMessages.length === 0) {
      toast({ title: "No new messages to summarize." });
      return;
    }
    const { summary } = await summarizeNotifications(unreadMessages, "Provide a concise summary.", preference);
    toast({
      title: "Notification Summary",
      description: summary,
      duration: 10000,
    });
  };

  const isChannel = 'name' in chat;
  const otherUser = !isChannel ? chat.participants.find(p => p.id !== currentUser.id) : null;
  const chatName = isChannel ? chat.name : otherUser?.name || 'Direct Message';
  const chatIcon = isChannel ? <Hash className="w-5 h-5 text-muted-foreground" /> : <UserAvatarWithStatus user={otherUser!} imageClassName="w-6 h-6" />;
  const chatMembers = isChannel ? `${[...new Set(chat.messages.map(m => m.author.id))].length} members` : (otherUser?.status === 'online' ? 'Online' : 'Offline');


  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between h-16 px-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          {chatIcon}
          <div>
            <h2 className="text-lg font-bold">{chatName}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {isChannel ? <Users className="w-3 h-3"/> : null}
              {chatMembers}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Bell className="w-5 h-5" />
                  <span className="sr-only">Summarize Notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSummarize('summary')}>
                  Summarize recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSummarize('full')}>
                  List recent in detail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

           <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-primary" />
            <Label htmlFor="smart-notifications">Smart</Label>
            <Switch id="smart-notifications" checked={useSmartNotifications} onCheckedChange={setUseSmartNotifications} />
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-6">
          {messages.map((message, index) => {
            const isFirstInGroup = index === 0 || messages[index - 1].author.id !== message.author.id;
            const hasContent = message.content && message.content.trim() !== '';
            
            return (
              <div key={message.id} className={cn("flex gap-3", !isFirstInGroup && "pl-11")}>
                {isFirstInGroup && <UserAvatarWithStatus user={message.author} imageClassName="w-8 h-8"/>}
                <div className="flex-1">
                  {isFirstInGroup && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold">{message.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {isClient ? format(new Date(message.timestamp), 'h:mm a') : ''}
                      </span>
                    </div>
                  )}
                  {hasContent && <p className="text-foreground leading-relaxed">{message.content}</p>}
                   {message.file && (
                     <div className={cn("rounded-lg border p-3 flex items-center gap-3 max-w-xs bg-card", hasContent && "mt-2", !hasContent && !isFirstInGroup && "pt-8 -mt-5")}>
                        {message.file.type === 'image' ? (
                            <Image src={message.file.url} alt={message.file.name} width={100} height={100} className="rounded-md object-cover" data-ai-hint="design abstract"/>
                        ) : (
                             <div className="flex items-center justify-center size-12 bg-secondary rounded-md">
                                <Paperclip className="size-6 text-muted-foreground"/>
                            </div>
                        )}
                        <div className="overflow-hidden">
                           <a href={message.file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">
                                {message.file.name}
                           </a>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <footer className="p-4 border-t shrink-0">
        <form onSubmit={handleSendMessage} className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${chatName}`}
            className="pr-24 resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-5 h-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Button type="submit" variant="ghost" size="icon">
              <SendHorizontal className="w-5 h-5 text-primary" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
        </form>
      </footer>
    </div>
  );
}
