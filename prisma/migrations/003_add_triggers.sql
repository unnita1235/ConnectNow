-- =============================================================================
-- MIGRATION: 003_add_triggers.sql
-- ConnectNow Database Triggers and Functions
-- =============================================================================
-- Description: Creates triggers for auto-timestamps, soft deletes, and data integrity
-- Author: ConnectNow Team
-- Date: 2024
-- =============================================================================

-- =============================================================================
-- TRIGGER FUNCTION: Auto-update updated_at timestamp
-- =============================================================================
-- This function is called by triggers to automatically update the updated_at
-- column whenever a row is modified.

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_set_updated_at() IS
  'Automatically sets updated_at to current timestamp on UPDATE';

-- =============================================================================
-- TRIGGER FUNCTION: Soft delete handler for messages
-- =============================================================================
-- When a message is soft deleted, replace content with "[deleted]"
-- and clear any sensitive data

CREATE OR REPLACE FUNCTION trigger_soft_delete_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when is_deleted changes from false to true
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.content = '[This message has been deleted]';
    NEW.deleted_at = NOW();
    -- Preserve original created_at
    NEW.created_at = OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_soft_delete_message() IS
  'Clears message content when soft deleted for privacy';

-- =============================================================================
-- TRIGGER FUNCTION: Soft delete handler for direct messages
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_soft_delete_direct_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.content = '[This message has been deleted]';
    NEW.deleted_at = NOW();
    NEW.created_at = OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_soft_delete_direct_message() IS
  'Clears DM content when soft deleted for privacy';

-- =============================================================================
-- TRIGGER FUNCTION: Update message version for optimistic locking
-- =============================================================================
-- Increments version number on each update to detect concurrent modifications

CREATE OR REPLACE FUNCTION trigger_increment_message_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if content is being edited (not soft delete)
  IF NEW.content != OLD.content AND NEW.is_deleted = false THEN
    NEW.version = OLD.version + 1;
    NEW.is_edited = true;
    NEW.edited_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_increment_message_version() IS
  'Increments version and sets edited flags when message is modified';

-- =============================================================================
-- TRIGGER FUNCTION: Update conversation last_message_at
-- =============================================================================
-- Keeps track of the most recent message in a conversation for sorting

CREATE OR REPLACE FUNCTION trigger_update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE direct_conversations
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_update_conversation_last_message() IS
  'Updates last_message_at when new DM is inserted';

-- =============================================================================
-- TRIGGER FUNCTION: Ensure direct conversation user order
-- =============================================================================
-- Ensures user_a_id < user_b_id for consistent conversation lookup

CREATE OR REPLACE FUNCTION trigger_order_conversation_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Swap if out of order
  IF NEW.user_a_id > NEW.user_b_id THEN
    DECLARE
      temp VARCHAR(30);
    BEGIN
      temp := NEW.user_a_id;
      NEW.user_a_id := NEW.user_b_id;
      NEW.user_b_id := temp;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_order_conversation_users() IS
  'Ensures user_a_id < user_b_id for unique constraint';

-- =============================================================================
-- TRIGGER FUNCTION: Update user last_login_at
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new session is created, update user's last_login_at
  UPDATE users
  SET last_login_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_update_last_login() IS
  'Updates user last_login_at when new session created';

-- =============================================================================
-- TRIGGER FUNCTION: Auto-create user presence record
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_create_user_presence()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_presence (user_id, status)
  VALUES (NEW.id, 'OFFLINE')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_create_user_presence() IS
  'Creates presence record when new user is registered';

-- =============================================================================
-- TRIGGER FUNCTION: Prevent email change after verification
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_prevent_email_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email_verified = true AND NEW.email != OLD.email THEN
    RAISE EXCEPTION 'Cannot change email after verification. Please use email change flow.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_prevent_email_change() IS
  'Prevents direct email changes for verified accounts';

-- =============================================================================
-- TRIGGER FUNCTION: Add owner as workspace member
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_add_workspace_owner_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'OWNER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_add_workspace_owner_member() IS
  'Automatically adds workspace owner as OWNER member';

-- =============================================================================
-- CREATE TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER users_prevent_email_change
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION trigger_prevent_email_change();

CREATE TRIGGER users_create_presence
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_user_presence();

-- -----------------------------------------------------------------------------
-- Sessions table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER sessions_update_last_login
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_last_login();

-- -----------------------------------------------------------------------------
-- Workspaces table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER workspaces_add_owner_member
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION trigger_add_workspace_owner_member();

-- -----------------------------------------------------------------------------
-- Workspace members table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- -----------------------------------------------------------------------------
-- Channels table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- -----------------------------------------------------------------------------
-- Channel members table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER channel_members_updated_at
  BEFORE UPDATE ON channel_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- -----------------------------------------------------------------------------
-- Messages table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER messages_soft_delete
  BEFORE UPDATE ON messages
  FOR EACH ROW
  WHEN (NEW.is_deleted IS DISTINCT FROM OLD.is_deleted)
  EXECUTE FUNCTION trigger_soft_delete_message();

CREATE TRIGGER messages_increment_version
  BEFORE UPDATE ON messages
  FOR EACH ROW
  WHEN (NEW.content IS DISTINCT FROM OLD.content)
  EXECUTE FUNCTION trigger_increment_message_version();

-- -----------------------------------------------------------------------------
-- Direct conversations table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER direct_conversations_updated_at
  BEFORE UPDATE ON direct_conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER direct_conversations_order_users
  BEFORE INSERT ON direct_conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_conversation_users();

-- -----------------------------------------------------------------------------
-- Direct messages table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER direct_messages_updated_at
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER direct_messages_soft_delete
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  WHEN (NEW.is_deleted IS DISTINCT FROM OLD.is_deleted)
  EXECUTE FUNCTION trigger_soft_delete_direct_message();

CREATE TRIGGER direct_messages_update_conversation
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_conversation_last_message();

-- -----------------------------------------------------------------------------
-- User presence table triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER user_presence_updated_at
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Get or create direct conversation between two users
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_user_a_id VARCHAR(30),
  p_user_b_id VARCHAR(30)
)
RETURNS VARCHAR(30) AS $$
DECLARE
  v_conversation_id VARCHAR(30);
  v_ordered_a VARCHAR(30);
  v_ordered_b VARCHAR(30);
BEGIN
  -- Ensure proper ordering
  IF p_user_a_id < p_user_b_id THEN
    v_ordered_a := p_user_a_id;
    v_ordered_b := p_user_b_id;
  ELSE
    v_ordered_a := p_user_b_id;
    v_ordered_b := p_user_a_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM direct_conversations
  WHERE user_a_id = v_ordered_a AND user_b_id = v_ordered_b;

  -- Create if not exists
  IF v_conversation_id IS NULL THEN
    INSERT INTO direct_conversations (user_a_id, user_b_id)
    VALUES (v_ordered_a, v_ordered_b)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_conversation(VARCHAR, VARCHAR) IS
  'Gets existing or creates new conversation between two users';

-- -----------------------------------------------------------------------------
-- Function: Count unread messages in a channel for a user
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION count_unread_messages(
  p_channel_id VARCHAR(30),
  p_user_id VARCHAR(30)
)
RETURNS INTEGER AS $$
DECLARE
  v_last_read TIMESTAMP WITH TIME ZONE;
  v_count INTEGER;
BEGIN
  -- Get user's last read timestamp
  SELECT last_read_at INTO v_last_read
  FROM channel_members
  WHERE channel_id = p_channel_id AND user_id = p_user_id;

  -- Count messages after last read
  IF v_last_read IS NULL THEN
    -- User never read, count all non-deleted messages
    SELECT COUNT(*) INTO v_count
    FROM messages
    WHERE channel_id = p_channel_id
      AND is_deleted = false
      AND user_id != p_user_id;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM messages
    WHERE channel_id = p_channel_id
      AND created_at > v_last_read
      AND is_deleted = false
      AND user_id != p_user_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_unread_messages(VARCHAR, VARCHAR) IS
  'Counts unread messages in a channel for a specific user';

-- -----------------------------------------------------------------------------
-- Function: Count unread DMs in a conversation for a user
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION count_unread_dms(
  p_conversation_id VARCHAR(30),
  p_user_id VARCHAR(30)
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM direct_messages
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false
    AND is_deleted = false;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION count_unread_dms(VARCHAR, VARCHAR) IS
  'Counts unread DMs in a conversation for a specific user';

-- -----------------------------------------------------------------------------
-- Function: Get online users in a workspace
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_online_workspace_members(
  p_workspace_id VARCHAR(30)
)
RETURNS TABLE (
  user_id VARCHAR(30),
  username VARCHAR(50),
  avatar_url VARCHAR(500),
  status "UserStatus",
  status_text VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.avatar_url,
    up.status,
    up.status_text
  FROM workspace_members wm
  JOIN users u ON wm.user_id = u.id
  JOIN user_presence up ON u.id = up.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND up.status IN ('ONLINE', 'AWAY', 'BUSY')
  ORDER BY
    CASE up.status
      WHEN 'ONLINE' THEN 1
      WHEN 'BUSY' THEN 2
      WHEN 'AWAY' THEN 3
    END,
    u.username;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_online_workspace_members(VARCHAR) IS
  'Returns all online/away/busy members in a workspace';

-- -----------------------------------------------------------------------------
-- Function: Clean up expired sessions (for scheduled job)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions() IS
  'Removes expired sessions. Run via scheduled job.';

-- =============================================================================
-- END OF TRIGGERS MIGRATION
-- =============================================================================
