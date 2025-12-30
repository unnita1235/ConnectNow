# ConnectNow Database Indexing Strategy

## Overview

This document outlines the indexing strategy for optimal query performance in the ConnectNow messaging platform. Indexes are critical for:

1. **Message pagination** - Fast retrieval of messages in channels
2. **User authentication** - Quick email/username lookups
3. **Presence queries** - Real-time online status filtering
4. **Channel listing** - Fast workspace channel queries

---

## Index Categories

### 1. Primary Indexes (Automatically Created)

These are created automatically by PostgreSQL for primary keys:

```sql
-- Primary keys (auto-indexed)
users.id
sessions.id
workspaces.id
workspace_members.id
channels.id
channel_members.id
messages.id
message_reactions.id
direct_conversations.id
direct_messages.id
user_presence.id
attachments.id
```

### 2. Unique Constraint Indexes (Automatically Created)

These indexes are created automatically for UNIQUE constraints:

```sql
-- Unique constraints (auto-indexed)
users.email                          -- Email lookup for login
users.username                       -- Username lookup
sessions.token                       -- JWT token validation
sessions.refreshToken                -- Refresh token lookup
workspaces.slug                      -- URL slug lookup
workspaces.inviteCode                -- Invite link validation
user_presence.userId                 -- One presence per user
```

### 3. Composite Unique Indexes

For ensuring data integrity:

```sql
-- Prevent duplicate memberships
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key"
  ON workspace_members(workspaceId, userId);

-- Prevent duplicate channel memberships
CREATE UNIQUE INDEX "channel_members_channelId_userId_key"
  ON channel_members(channelId, userId);

-- Unique channel names per workspace
CREATE UNIQUE INDEX "channels_workspaceId_name_key"
  ON channels(workspaceId, name);

-- Unique conversations between two users
CREATE UNIQUE INDEX "direct_conversations_userAId_userBId_key"
  ON direct_conversations(userAId, userBId);

-- Prevent duplicate emoji reactions from same user
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key"
  ON message_reactions(messageId, userId, emoji);
```

---

## Critical Performance Indexes

### 4. Message Pagination Index (MOST IMPORTANT)

This is the most frequently used query - loading messages in a channel:

```sql
-- Primary index for message pagination
-- Query: SELECT * FROM messages WHERE channelId = ? ORDER BY createdAt DESC LIMIT 50
CREATE INDEX "messages_channelId_createdAt_idx"
  ON messages(channelId, createdAt DESC);

-- Estimated usage: 10,000+ queries/hour
-- Query pattern: Paginated message loading, infinite scroll
```

**Query it optimizes:**
```sql
SELECT m.*, u.username, u.avatarUrl
FROM messages m
JOIN users u ON m.userId = u.id
WHERE m.channelId = 'channel_123'
  AND m.isDeleted = false
ORDER BY m.createdAt DESC
LIMIT 50 OFFSET 0;
```

### 5. Direct Message Pagination Index

Similar to channel messages, but for DMs:

```sql
-- Direct message pagination
CREATE INDEX "direct_messages_conversationId_createdAt_idx"
  ON direct_messages(conversationId, createdAt DESC);

-- Estimated usage: 5,000+ queries/hour
```

### 6. User Message History Index

For "show my messages" and moderation features:

```sql
-- User's message history
CREATE INDEX "messages_userId_createdAt_idx"
  ON messages(userId, createdAt DESC);

-- Direct messages sent by user
CREATE INDEX "direct_messages_senderId_createdAt_idx"
  ON direct_messages(senderId, createdAt DESC);
```

### 7. Channel Listing Indexes

For workspace sidebar:

```sql
-- List all channels in a workspace
CREATE INDEX "channels_workspaceId_idx"
  ON channels(workspaceId);

-- Filter by visibility
CREATE INDEX "channels_workspaceId_isPrivate_idx"
  ON channels(workspaceId, isPrivate);

-- Find user's channels quickly
CREATE INDEX "channel_members_userId_idx"
  ON channel_members(userId);
```

### 8. Presence/Online Status Indexes

For real-time features:

```sql
-- Filter online users
CREATE INDEX "user_presence_status_idx"
  ON user_presence(status);

-- Sort by last activity
CREATE INDEX "user_presence_lastActiveAt_idx"
  ON user_presence(lastActiveAt);
```

### 9. Session Management Indexes

For authentication:

```sql
-- Find sessions for a user
CREATE INDEX "sessions_userId_idx"
  ON sessions(userId);

-- Clean up expired sessions
CREATE INDEX "sessions_expiresAt_idx"
  ON sessions(expiresAt);
```

---

## Complete Index SQL Script

```sql
-- =============================================================================
-- CONNECTNOW DATABASE INDEXES
-- Run this after initial schema migration
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "users_email_idx" ON users(email);
CREATE INDEX IF NOT EXISTS "users_username_idx" ON users(username);
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON users(createdAt);
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON users(isActive);

-- -----------------------------------------------------------------------------
-- SESSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON sessions(userId);
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON sessions(token);
CREATE INDEX IF NOT EXISTS "sessions_refreshToken_idx" ON sessions(refreshToken);
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON sessions(expiresAt);

-- -----------------------------------------------------------------------------
-- WORKSPACES TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "workspaces_ownerId_idx" ON workspaces(ownerId);
CREATE INDEX IF NOT EXISTS "workspaces_slug_idx" ON workspaces(slug);
CREATE INDEX IF NOT EXISTS "workspaces_inviteCode_idx" ON workspaces(inviteCode);
CREATE INDEX IF NOT EXISTS "workspaces_createdAt_idx" ON workspaces(createdAt);

-- -----------------------------------------------------------------------------
-- WORKSPACE_MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "workspace_members_userId_idx" ON workspace_members(userId);
CREATE INDEX IF NOT EXISTS "workspace_members_workspaceId_idx" ON workspace_members(workspaceId);
CREATE INDEX IF NOT EXISTS "workspace_members_role_idx" ON workspace_members(role);

-- -----------------------------------------------------------------------------
-- CHANNELS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "channels_workspaceId_idx" ON channels(workspaceId);
CREATE INDEX IF NOT EXISTS "channels_workspaceId_isPrivate_idx" ON channels(workspaceId, isPrivate);
CREATE INDEX IF NOT EXISTS "channels_createdAt_idx" ON channels(createdAt);
CREATE INDEX IF NOT EXISTS "channels_isArchived_idx" ON channels(isArchived);

-- -----------------------------------------------------------------------------
-- CHANNEL_MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "channel_members_userId_idx" ON channel_members(userId);
CREATE INDEX IF NOT EXISTS "channel_members_channelId_idx" ON channel_members(channelId);
CREATE INDEX IF NOT EXISTS "channel_members_lastReadAt_idx" ON channel_members(lastReadAt);

-- -----------------------------------------------------------------------------
-- MESSAGES TABLE (CRITICAL FOR PERFORMANCE)
-- -----------------------------------------------------------------------------
-- Primary pagination index - most important!
CREATE INDEX IF NOT EXISTS "messages_channelId_createdAt_idx"
  ON messages(channelId, createdAt DESC);

-- User's message history
CREATE INDEX IF NOT EXISTS "messages_userId_createdAt_idx"
  ON messages(userId, createdAt DESC);

-- Thread replies
CREATE INDEX IF NOT EXISTS "messages_parentId_idx" ON messages(parentId);

-- Pinned messages lookup
CREATE INDEX IF NOT EXISTS "messages_channelId_isPinned_idx"
  ON messages(channelId, isPinned)
  WHERE isPinned = true;

-- Exclude deleted messages (partial index)
CREATE INDEX IF NOT EXISTS "messages_isDeleted_idx"
  ON messages(isDeleted)
  WHERE isDeleted = false;

-- -----------------------------------------------------------------------------
-- MESSAGE_REACTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "message_reactions_messageId_idx"
  ON message_reactions(messageId);
CREATE INDEX IF NOT EXISTS "message_reactions_userId_idx"
  ON message_reactions(userId);

-- -----------------------------------------------------------------------------
-- DIRECT_CONVERSATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "direct_conversations_userAId_idx"
  ON direct_conversations(userAId);
CREATE INDEX IF NOT EXISTS "direct_conversations_userBId_idx"
  ON direct_conversations(userBId);
CREATE INDEX IF NOT EXISTS "direct_conversations_lastMessageAt_idx"
  ON direct_conversations(lastMessageAt DESC);

-- -----------------------------------------------------------------------------
-- DIRECT_MESSAGES TABLE
-- -----------------------------------------------------------------------------
-- Primary pagination index for DMs
CREATE INDEX IF NOT EXISTS "direct_messages_conversationId_createdAt_idx"
  ON direct_messages(conversationId, createdAt DESC);

-- Sender's message history
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_createdAt_idx"
  ON direct_messages(senderId, createdAt DESC);

-- Unread messages
CREATE INDEX IF NOT EXISTS "direct_messages_isRead_idx"
  ON direct_messages(isRead)
  WHERE isRead = false;

-- Exclude deleted
CREATE INDEX IF NOT EXISTS "direct_messages_isDeleted_idx"
  ON direct_messages(isDeleted)
  WHERE isDeleted = false;

-- -----------------------------------------------------------------------------
-- USER_PRESENCE TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "user_presence_status_idx" ON user_presence(status);
CREATE INDEX IF NOT EXISTS "user_presence_lastActiveAt_idx" ON user_presence(lastActiveAt);

-- -----------------------------------------------------------------------------
-- ATTACHMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "attachments_uploaderId_idx" ON attachments(uploaderId);
CREATE INDEX IF NOT EXISTS "attachments_messageId_idx" ON attachments(messageId);
CREATE INDEX IF NOT EXISTS "attachments_directMessageId_idx" ON attachments(directMessageId);
CREATE INDEX IF NOT EXISTS "attachments_mimeType_idx" ON attachments(mimeType);
```

---

## Query Performance Estimates

| Query Type                    | Without Index | With Index  | Improvement |
|------------------------------|---------------|-------------|-------------|
| Load 50 messages in channel  | ~200ms        | ~5ms        | 40x faster  |
| Find user by email           | ~100ms        | ~2ms        | 50x faster  |
| List workspace channels      | ~50ms         | ~3ms        | 17x faster  |
| Get online users             | ~80ms         | ~4ms        | 20x faster  |
| User's message history       | ~150ms        | ~8ms        | 19x faster  |

---

## Index Maintenance

### Analyze Table Statistics
Run periodically to help query planner:

```sql
ANALYZE users;
ANALYZE messages;
ANALYZE channels;
ANALYZE direct_messages;
ANALYZE user_presence;
```

### Reindex for Performance
If indexes become fragmented:

```sql
REINDEX TABLE messages;
REINDEX TABLE direct_messages;
```

### Check Index Usage
Monitor which indexes are being used:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Identify Unused Indexes
Remove unused indexes to save space:

```sql
SELECT
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public';
```

---

## Notes

1. **Partial Indexes**: Used for `isDeleted = false` to reduce index size
2. **Composite Indexes**: Column order matters - put equality columns first, range columns last
3. **Descending Order**: Use DESC for timestamp columns in pagination queries
4. **BRIN Indexes**: Consider for very large tables with sequential data (future optimization)
