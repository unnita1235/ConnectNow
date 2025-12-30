-- =============================================================================
-- MIGRATION: 001_initial_schema.sql
-- ConnectNow Database Initial Schema
-- =============================================================================
-- Description: Creates all tables for the ConnectNow messaging platform
-- Author: ConnectNow Team
-- Date: 2024
-- =============================================================================

-- Enable UUID extension for generating UUIDs if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- User online status
CREATE TYPE "UserStatus" AS ENUM (
  'ONLINE',
  'AWAY',
  'BUSY',
  'OFFLINE'
);

-- Channel type
CREATE TYPE "ChannelType" AS ENUM (
  'TEXT',
  'VOICE',
  'FORUM'
);

-- Member roles
CREATE TYPE "MemberRole" AS ENUM (
  'OWNER',
  'ADMIN',
  'MODERATOR',
  'MEMBER',
  'GUEST'
);

-- Message type
CREATE TYPE "MessageType" AS ENUM (
  'TEXT',
  'IMAGE',
  'FILE',
  'VIDEO',
  'AUDIO',
  'SYSTEM'
);

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Core user identity table for authentication and profiles

CREATE TABLE users (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  email           VARCHAR(255) NOT NULL,
  username        VARCHAR(50) NOT NULL,
  display_name    VARCHAR(100),
  password_hash   VARCHAR(255) NOT NULL,
  avatar_url      VARCHAR(500),
  bio             TEXT,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMP WITH TIME ZONE,

  -- Email verification
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,

  -- Account status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Constraints
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_username_format CHECK (username ~* '^[a-zA-Z0-9_]{3,30}$')
);

COMMENT ON TABLE users IS 'User accounts with authentication and profile data';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password - never store plaintext';
COMMENT ON COLUMN users.is_banned IS 'Set to true for moderation/ban purposes';

-- =============================================================================
-- SESSIONS TABLE
-- =============================================================================
-- JWT session management for authentication

CREATE TABLE sessions (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  user_id         VARCHAR(30) NOT NULL,

  -- Tokens
  token           VARCHAR(500) NOT NULL,
  refresh_token   VARCHAR(500),

  -- Metadata
  user_agent      VARCHAR(500),
  ip_address      VARCHAR(45), -- IPv6 max length

  -- Expiration
  expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sessions_token_unique UNIQUE (token),
  CONSTRAINT sessions_refresh_token_unique UNIQUE (refresh_token),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE sessions IS 'Active user sessions for JWT management';

-- =============================================================================
-- WORKSPACES TABLE
-- =============================================================================
-- Team containers (like Slack workspaces)

CREATE TABLE workspaces (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  description     TEXT,
  icon_url        VARCHAR(500),

  -- Owner
  owner_id        VARCHAR(30) NOT NULL,

  -- Settings
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  invite_code     VARCHAR(20),

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workspaces_slug_unique UNIQUE (slug),
  CONSTRAINT workspaces_invite_code_unique UNIQUE (invite_code),
  CONSTRAINT workspaces_owner_fk FOREIGN KEY (owner_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT workspaces_slug_format CHECK (slug ~* '^[a-z0-9-]{3,50}$')
);

COMMENT ON TABLE workspaces IS 'Team workspaces containing channels and members';

-- =============================================================================
-- WORKSPACE_MEMBERS TABLE
-- =============================================================================
-- Many-to-many: Users <-> Workspaces

CREATE TABLE workspace_members (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  workspace_id    VARCHAR(30) NOT NULL,
  user_id         VARCHAR(30) NOT NULL,

  role            "MemberRole" NOT NULL DEFAULT 'MEMBER',
  nickname        VARCHAR(50),

  -- Timestamps
  joined_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_members_workspace_fk FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT workspace_members_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE workspace_members IS 'Workspace membership with roles';

-- =============================================================================
-- CHANNELS TABLE
-- =============================================================================
-- Communication channels within workspaces

CREATE TABLE channels (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  workspace_id    VARCHAR(30) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  topic           VARCHAR(250),

  -- Configuration
  type            "ChannelType" NOT NULL DEFAULT 'TEXT',
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  position        INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT channels_workspace_name_unique UNIQUE (workspace_id, name),
  CONSTRAINT channels_workspace_fk FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT channels_name_format CHECK (name ~* '^[a-zA-Z0-9_-]{1,100}$')
);

COMMENT ON TABLE channels IS 'Chat channels within workspaces';
COMMENT ON COLUMN channels.position IS 'Order position in sidebar';

-- =============================================================================
-- CHANNEL_MEMBERS TABLE
-- =============================================================================
-- Many-to-many: Users <-> Channels

CREATE TABLE channel_members (
  id                    VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  channel_id            VARCHAR(30) NOT NULL,
  user_id               VARCHAR(30) NOT NULL,

  role                  "MemberRole" NOT NULL DEFAULT 'MEMBER',
  is_muted              BOOLEAN NOT NULL DEFAULT FALSE,

  -- Read tracking
  last_read_at          TIMESTAMP WITH TIME ZONE,
  last_read_message_id  VARCHAR(30),

  -- Timestamps
  joined_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT channel_members_unique UNIQUE (channel_id, user_id),
  CONSTRAINT channel_members_channel_fk FOREIGN KEY (channel_id)
    REFERENCES channels(id) ON DELETE CASCADE,
  CONSTRAINT channel_members_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE channel_members IS 'Channel membership and read tracking';

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- Messages in channels with thread support

CREATE TABLE messages (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  channel_id      VARCHAR(30) NOT NULL,
  user_id         VARCHAR(30) NOT NULL,

  -- Content
  content         TEXT NOT NULL,
  type            "MessageType" NOT NULL DEFAULT 'TEXT',

  -- Threading
  parent_id       VARCHAR(30),

  -- Edit tracking
  is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at       TIMESTAMP WITH TIME ZONE,

  -- Soft delete
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMP WITH TIME ZONE,

  -- Pinning
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at       TIMESTAMP WITH TIME ZONE,
  pinned_by       VARCHAR(30),

  -- Optimistic locking
  version         INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT messages_channel_fk FOREIGN KEY (channel_id)
    REFERENCES channels(id) ON DELETE CASCADE,
  CONSTRAINT messages_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT messages_parent_fk FOREIGN KEY (parent_id)
    REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT messages_version_positive CHECK (version > 0)
);

COMMENT ON TABLE messages IS 'Channel messages with threading and soft delete';
COMMENT ON COLUMN messages.version IS 'Incremented on update for optimistic locking';

-- =============================================================================
-- MESSAGE_REACTIONS TABLE
-- =============================================================================
-- Emoji reactions on messages

CREATE TABLE message_reactions (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  message_id      VARCHAR(30) NOT NULL,
  user_id         VARCHAR(30) NOT NULL,

  emoji           VARCHAR(50) NOT NULL,

  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints: prevent duplicate reactions
  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji),
  CONSTRAINT message_reactions_message_fk FOREIGN KEY (message_id)
    REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT message_reactions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE message_reactions IS 'Emoji reactions on messages';

-- =============================================================================
-- DIRECT_CONVERSATIONS TABLE
-- =============================================================================
-- Container for 1-on-1 conversations

CREATE TABLE direct_conversations (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),

  -- Two participants (always store lower ID in user_a_id)
  user_a_id       VARCHAR(30) NOT NULL,
  user_b_id       VARCHAR(30) NOT NULL,

  -- Last activity
  last_message_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT direct_conversations_unique UNIQUE (user_a_id, user_b_id),
  CONSTRAINT direct_conversations_user_a_fk FOREIGN KEY (user_a_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT direct_conversations_user_b_fk FOREIGN KEY (user_b_id)
    REFERENCES users(id) ON DELETE CASCADE,
  -- Ensure user_a_id < user_b_id for consistent ordering
  CONSTRAINT direct_conversations_order CHECK (user_a_id < user_b_id)
);

COMMENT ON TABLE direct_conversations IS '1-on-1 conversation containers';
COMMENT ON COLUMN direct_conversations.user_a_id IS 'Must be less than user_b_id for uniqueness';

-- =============================================================================
-- DIRECT_MESSAGES TABLE
-- =============================================================================
-- Messages in direct conversations

CREATE TABLE direct_messages (
  id                VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  conversation_id   VARCHAR(30) NOT NULL,
  sender_id         VARCHAR(30) NOT NULL,

  -- Content
  content           TEXT NOT NULL,
  type              "MessageType" NOT NULL DEFAULT 'TEXT',

  -- Edit tracking
  is_edited         BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at         TIMESTAMP WITH TIME ZONE,

  -- Soft delete
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMP WITH TIME ZONE,

  -- Read receipt
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  read_at           TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT direct_messages_conversation_fk FOREIGN KEY (conversation_id)
    REFERENCES direct_conversations(id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_sender_fk FOREIGN KEY (sender_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE direct_messages IS 'Messages in direct conversations';

-- =============================================================================
-- USER_PRESENCE TABLE
-- =============================================================================
-- Real-time online/offline status

CREATE TABLE user_presence (
  id              VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),
  user_id         VARCHAR(30) NOT NULL,

  status          "UserStatus" NOT NULL DEFAULT 'OFFLINE',
  status_text     VARCHAR(100),

  -- Activity
  last_active_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Socket connections (stored as JSON array)
  socket_ids      TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_presence_user_unique UNIQUE (user_id),
  CONSTRAINT user_presence_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE user_presence IS 'Real-time user online status';
COMMENT ON COLUMN user_presence.socket_ids IS 'Active socket connection IDs for multi-device';

-- =============================================================================
-- ATTACHMENTS TABLE
-- =============================================================================
-- File attachments for messages

CREATE TABLE attachments (
  id                  VARCHAR(30) PRIMARY KEY DEFAULT substring(md5(random()::text), 1, 25),

  -- File info
  file_name           VARCHAR(255) NOT NULL,
  file_size           INTEGER NOT NULL,
  mime_type           VARCHAR(100) NOT NULL,
  file_url            VARCHAR(500) NOT NULL,
  thumbnail_url       VARCHAR(500),

  -- Metadata
  width               INTEGER,
  height              INTEGER,
  duration            INTEGER, -- For audio/video in seconds

  -- Owner
  uploader_id         VARCHAR(30) NOT NULL,

  -- Can be attached to channel message or direct message
  message_id          VARCHAR(30),
  direct_message_id   VARCHAR(30),

  -- Timestamp
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT attachments_uploader_fk FOREIGN KEY (uploader_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT attachments_message_fk FOREIGN KEY (message_id)
    REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT attachments_dm_fk FOREIGN KEY (direct_message_id)
    REFERENCES direct_messages(id) ON DELETE SET NULL,
  CONSTRAINT attachments_file_size_positive CHECK (file_size > 0),
  CONSTRAINT attachments_one_parent CHECK (
    (message_id IS NOT NULL AND direct_message_id IS NULL) OR
    (message_id IS NULL AND direct_message_id IS NOT NULL) OR
    (message_id IS NULL AND direct_message_id IS NULL)
  )
);

COMMENT ON TABLE attachments IS 'File attachments for messages';

-- =============================================================================
-- END OF INITIAL SCHEMA
-- =============================================================================
