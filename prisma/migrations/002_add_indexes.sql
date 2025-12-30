-- =============================================================================
-- MIGRATION: 002_add_indexes.sql
-- ConnectNow Database Performance Indexes
-- =============================================================================
-- Description: Creates all performance indexes for optimal query speed
-- Author: ConnectNow Team
-- Date: 2024
-- =============================================================================

-- =============================================================================
-- USERS TABLE INDEXES
-- =============================================================================

-- Email lookup for authentication (login flow)
-- Query: SELECT * FROM users WHERE email = ?
CREATE INDEX IF NOT EXISTS "idx_users_email" ON users(email);

-- Username search and lookup
-- Query: SELECT * FROM users WHERE username = ?
CREATE INDEX IF NOT EXISTS "idx_users_username" ON users(username);

-- User listing with pagination
-- Query: SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
CREATE INDEX IF NOT EXISTS "idx_users_created_at" ON users(created_at DESC);

-- Filter active/inactive users
-- Query: SELECT * FROM users WHERE is_active = true
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON users(is_active);

-- =============================================================================
-- SESSIONS TABLE INDEXES
-- =============================================================================

-- Find sessions by user (for logout all devices)
-- Query: SELECT * FROM sessions WHERE user_id = ?
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON sessions(user_id);

-- Token validation (every authenticated request)
-- Query: SELECT * FROM sessions WHERE token = ?
CREATE INDEX IF NOT EXISTS "idx_sessions_token" ON sessions(token);

-- Refresh token lookup
-- Query: SELECT * FROM sessions WHERE refresh_token = ?
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh_token" ON sessions(refresh_token);

-- Expired session cleanup (scheduled job)
-- Query: DELETE FROM sessions WHERE expires_at < NOW()
CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at" ON sessions(expires_at);

-- =============================================================================
-- WORKSPACES TABLE INDEXES
-- =============================================================================

-- Find workspaces owned by user
-- Query: SELECT * FROM workspaces WHERE owner_id = ?
CREATE INDEX IF NOT EXISTS "idx_workspaces_owner_id" ON workspaces(owner_id);

-- URL slug lookup
-- Query: SELECT * FROM workspaces WHERE slug = ?
CREATE INDEX IF NOT EXISTS "idx_workspaces_slug" ON workspaces(slug);

-- Invite code validation
-- Query: SELECT * FROM workspaces WHERE invite_code = ?
CREATE INDEX IF NOT EXISTS "idx_workspaces_invite_code" ON workspaces(invite_code);

-- Workspace listing
-- Query: SELECT * FROM workspaces ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "idx_workspaces_created_at" ON workspaces(created_at DESC);

-- =============================================================================
-- WORKSPACE_MEMBERS TABLE INDEXES
-- =============================================================================

-- Find user's workspaces (sidebar)
-- Query: SELECT w.* FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = ?
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user_id" ON workspace_members(user_id);

-- List workspace members
-- Query: SELECT u.* FROM users u JOIN workspace_members wm ON u.id = wm.user_id WHERE wm.workspace_id = ?
CREATE INDEX IF NOT EXISTS "idx_workspace_members_workspace_id" ON workspace_members(workspace_id);

-- Filter by role (find admins, etc.)
-- Query: SELECT * FROM workspace_members WHERE workspace_id = ? AND role = ?
CREATE INDEX IF NOT EXISTS "idx_workspace_members_role" ON workspace_members(role);

-- =============================================================================
-- CHANNELS TABLE INDEXES
-- =============================================================================

-- List channels in workspace (sidebar - CRITICAL)
-- Query: SELECT * FROM channels WHERE workspace_id = ? ORDER BY position
CREATE INDEX IF NOT EXISTS "idx_channels_workspace_id" ON channels(workspace_id);

-- Filter public/private channels
-- Query: SELECT * FROM channels WHERE workspace_id = ? AND is_private = false
CREATE INDEX IF NOT EXISTS "idx_channels_workspace_private" ON channels(workspace_id, is_private);

-- Channel listing pagination
-- Query: SELECT * FROM channels ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "idx_channels_created_at" ON channels(created_at DESC);

-- Filter archived channels
-- Query: SELECT * FROM channels WHERE workspace_id = ? AND is_archived = false
CREATE INDEX IF NOT EXISTS "idx_channels_is_archived" ON channels(is_archived);

-- =============================================================================
-- CHANNEL_MEMBERS TABLE INDEXES
-- =============================================================================

-- Find user's channels (CRITICAL for permissions)
-- Query: SELECT * FROM channel_members WHERE user_id = ?
CREATE INDEX IF NOT EXISTS "idx_channel_members_user_id" ON channel_members(user_id);

-- List channel members
-- Query: SELECT u.* FROM users u JOIN channel_members cm ON u.id = cm.user_id WHERE cm.channel_id = ?
CREATE INDEX IF NOT EXISTS "idx_channel_members_channel_id" ON channel_members(channel_id);

-- Unread message calculations
-- Query: SELECT * FROM channel_members WHERE last_read_at < (SELECT MAX(created_at) FROM messages WHERE channel_id = cm.channel_id)
CREATE INDEX IF NOT EXISTS "idx_channel_members_last_read_at" ON channel_members(last_read_at);

-- =============================================================================
-- MESSAGES TABLE INDEXES (MOST CRITICAL)
-- =============================================================================

-- PRIMARY: Message pagination in channel (MOST USED QUERY)
-- Query: SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT 50
-- This index is CRITICAL for chat performance!
CREATE INDEX IF NOT EXISTS "idx_messages_channel_created_at"
  ON messages(channel_id, created_at DESC);

-- User's message history
-- Query: SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "idx_messages_user_created_at"
  ON messages(user_id, created_at DESC);

-- Thread replies lookup
-- Query: SELECT * FROM messages WHERE parent_id = ? ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS "idx_messages_parent_id" ON messages(parent_id);

-- Pinned messages in channel
-- Query: SELECT * FROM messages WHERE channel_id = ? AND is_pinned = true
CREATE INDEX IF NOT EXISTS "idx_messages_channel_pinned"
  ON messages(channel_id, is_pinned)
  WHERE is_pinned = true;

-- Exclude deleted messages (partial index saves space)
-- Query: SELECT * FROM messages WHERE channel_id = ? AND is_deleted = false
CREATE INDEX IF NOT EXISTS "idx_messages_not_deleted"
  ON messages(channel_id, created_at DESC)
  WHERE is_deleted = false;

-- =============================================================================
-- MESSAGE_REACTIONS TABLE INDEXES
-- =============================================================================

-- Get reactions for a message
-- Query: SELECT * FROM message_reactions WHERE message_id = ?
CREATE INDEX IF NOT EXISTS "idx_message_reactions_message_id"
  ON message_reactions(message_id);

-- Get user's reactions
-- Query: SELECT * FROM message_reactions WHERE user_id = ?
CREATE INDEX IF NOT EXISTS "idx_message_reactions_user_id"
  ON message_reactions(user_id);

-- =============================================================================
-- DIRECT_CONVERSATIONS TABLE INDEXES
-- =============================================================================

-- Find user's conversations (as user A)
-- Query: SELECT * FROM direct_conversations WHERE user_a_id = ?
CREATE INDEX IF NOT EXISTS "idx_direct_conversations_user_a_id"
  ON direct_conversations(user_a_id);

-- Find user's conversations (as user B)
-- Query: SELECT * FROM direct_conversations WHERE user_b_id = ?
CREATE INDEX IF NOT EXISTS "idx_direct_conversations_user_b_id"
  ON direct_conversations(user_b_id);

-- Sort by recent activity
-- Query: SELECT * FROM direct_conversations WHERE user_a_id = ? OR user_b_id = ? ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS "idx_direct_conversations_last_message"
  ON direct_conversations(last_message_at DESC);

-- =============================================================================
-- DIRECT_MESSAGES TABLE INDEXES (CRITICAL)
-- =============================================================================

-- PRIMARY: DM pagination (CRITICAL)
-- Query: SELECT * FROM direct_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS "idx_direct_messages_conversation_created"
  ON direct_messages(conversation_id, created_at DESC);

-- Sender's message history
-- Query: SELECT * FROM direct_messages WHERE sender_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "idx_direct_messages_sender_created"
  ON direct_messages(sender_id, created_at DESC);

-- Unread messages count (partial index)
-- Query: SELECT COUNT(*) FROM direct_messages WHERE conversation_id = ? AND is_read = false
CREATE INDEX IF NOT EXISTS "idx_direct_messages_unread"
  ON direct_messages(conversation_id, is_read)
  WHERE is_read = false;

-- Exclude deleted (partial index)
-- Query: SELECT * FROM direct_messages WHERE conversation_id = ? AND is_deleted = false
CREATE INDEX IF NOT EXISTS "idx_direct_messages_not_deleted"
  ON direct_messages(conversation_id, created_at DESC)
  WHERE is_deleted = false;

-- =============================================================================
-- USER_PRESENCE TABLE INDEXES
-- =============================================================================

-- Filter by online status (CRITICAL for presence)
-- Query: SELECT * FROM user_presence WHERE status = 'ONLINE'
CREATE INDEX IF NOT EXISTS "idx_user_presence_status"
  ON user_presence(status);

-- Sort by last activity
-- Query: SELECT * FROM user_presence ORDER BY last_active_at DESC
CREATE INDEX IF NOT EXISTS "idx_user_presence_last_active"
  ON user_presence(last_active_at DESC);

-- =============================================================================
-- ATTACHMENTS TABLE INDEXES
-- =============================================================================

-- Find files uploaded by user
-- Query: SELECT * FROM attachments WHERE uploader_id = ?
CREATE INDEX IF NOT EXISTS "idx_attachments_uploader_id"
  ON attachments(uploader_id);

-- Find attachments for a message
-- Query: SELECT * FROM attachments WHERE message_id = ?
CREATE INDEX IF NOT EXISTS "idx_attachments_message_id"
  ON attachments(message_id);

-- Find attachments for a DM
-- Query: SELECT * FROM attachments WHERE direct_message_id = ?
CREATE INDEX IF NOT EXISTS "idx_attachments_direct_message_id"
  ON attachments(direct_message_id);

-- Filter by file type
-- Query: SELECT * FROM attachments WHERE mime_type LIKE 'image/%'
CREATE INDEX IF NOT EXISTS "idx_attachments_mime_type"
  ON attachments(mime_type);

-- =============================================================================
-- COMPOSITE INDEXES FOR COMMON JOINS
-- =============================================================================

-- Optimized for message fetch with user info
-- Query: SELECT m.*, u.username, u.avatar_url FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = ?
CREATE INDEX IF NOT EXISTS "idx_messages_channel_user"
  ON messages(channel_id, user_id, created_at DESC);

-- Optimized for workspace member lookup with role
-- Query: SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?
CREATE INDEX IF NOT EXISTS "idx_workspace_members_lookup"
  ON workspace_members(workspace_id, user_id);

-- Optimized for channel member lookup with role
-- Query: SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?
CREATE INDEX IF NOT EXISTS "idx_channel_members_lookup"
  ON channel_members(channel_id, user_id);

-- =============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- =============================================================================
-- Updates statistics for the query planner

ANALYZE users;
ANALYZE sessions;
ANALYZE workspaces;
ANALYZE workspace_members;
ANALYZE channels;
ANALYZE channel_members;
ANALYZE messages;
ANALYZE message_reactions;
ANALYZE direct_conversations;
ANALYZE direct_messages;
ANALYZE user_presence;
ANALYZE attachments;

-- =============================================================================
-- END OF INDEXES MIGRATION
-- =============================================================================
