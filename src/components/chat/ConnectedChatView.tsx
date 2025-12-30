/**
 * Connected Chat View Component
 * =============================================================================
 * Chat view that connects to real backend APIs and Socket.IO
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Hash, Users, Loader2, WifiOff, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { FileUpload } from './FileUpload';
import { useMessages } from '@/hooks/useMessages';
import { useFileUpload } from '@/hooks/useFileUpload';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT';
  _count?: {
    members: number;
  };
}

interface ConnectedChatViewProps {
  channel: Channel;
  workspaceId: string;
  className?: string;
}

export function ConnectedChatView({ channel, workspaceId, className }: ConnectedChatViewProps) {
  const { data: session } = useSession();
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  const {
    messages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    isConnected,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  } = useMessages({ channelId: channel.id, enableRealtime: true });

  const handleSendMessage = useCallback(async (content: string) => {
    await sendMessage(content, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    setPendingAttachments([]);
  }, [sendMessage, pendingAttachments]);

  const handleUploadComplete = useCallback((results: { publicId: string }[]) => {
    setPendingAttachments((prev) => [...prev, ...results.map((r) => r.publicId)]);
    setShowUploader(false);
  }, []);

  const currentUserId = session?.user?.id || '';

  return (
    <div className={cn('flex flex-col h-screen bg-background', className)}>
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
            <Hash className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-muted-foreground truncate max-w-md">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={cn(
              'gap-1',
              isConnected ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Connecting...
              </>
            )}
          </Badge>

          {/* Member count */}
          {channel._count && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{channel._count.members}</span>
            </div>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onReact={addReaction}
        onRemoveReaction={removeReaction}
      />

      {/* Typing indicator */}
      <TypingIndicator channelId={channel.id} />

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {pendingAttachments.length} file(s) ready to send
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingAttachments([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* File uploader overlay */}
      {showUploader && (
        <div className="px-4 py-4 border-t bg-background">
          <FileUpload
            type="message"
            workspaceId={workspaceId}
            channelId={channel.id}
            onUploadComplete={handleUploadComplete}
            onUploadStart={() => {}}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUploader(false)}
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Message input */}
      <footer className="p-4 border-t shrink-0">
        <MessageInput
          channelId={channel.id}
          placeholder={`Message #${channel.name}`}
          onSend={handleSendMessage}
          onAttachClick={() => setShowUploader(!showUploader)}
          disabled={isLoading}
        />
      </footer>
    </div>
  );
}
