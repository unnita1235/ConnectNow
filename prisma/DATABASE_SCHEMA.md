# ConnectNow Database Schema Documentation

## Overview
This document describes the complete database schema for ConnectNow, a real-time messaging platform.

---

## ASCII Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONNECTNOW DATABASE SCHEMA                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                    AUTHENTICATION
    ┌──────────────────────────────────────────────────────────────────┐
    │                                                                  │
    │   ┌─────────────────────┐         ┌─────────────────────┐       │
    │   │       USERS         │ 1───n   │      SESSIONS       │       │
    │   ├─────────────────────┤         ├─────────────────────┤       │
    │   │ id (PK)             │────────>│ id (PK)             │       │
    │   │ email (UNIQUE)      │         │ userId (FK)         │       │
    │   │ username (UNIQUE)   │         │ token (UNIQUE)      │       │
    │   │ displayName         │         │ refreshToken        │       │
    │   │ passwordHash        │         │ expiresAt           │       │
    │   │ avatarUrl           │         │ userAgent           │       │
    │   │ bio                 │         │ ipAddress           │       │
    │   │ emailVerified       │         │ createdAt           │       │
    │   │ isActive            │         │ lastActiveAt        │       │
    │   │ isBanned            │         └─────────────────────┘       │
    │   │ createdAt           │                                       │
    │   │ updatedAt           │         ┌─────────────────────┐       │
    │   │ lastLoginAt         │ 1───1   │   USER_PRESENCE     │       │
    │   └─────────────────────┘────────>├─────────────────────┤       │
    │             │                     │ id (PK)             │       │
    │             │                     │ userId (FK, UNIQUE) │       │
    │             │                     │ status (ENUM)       │       │
    │             │                     │ statusText          │       │
    │             │                     │ lastActiveAt        │       │
    │             │                     │ socketIds[]         │       │
    │             │                     └─────────────────────┘       │
    └─────────────│────────────────────────────────────────────────────┘
                  │
                  │
    ┌─────────────▼────────────────────────────────────────────────────┐
    │                         WORKSPACES                               │
    │                                                                  │
    │   ┌─────────────────────┐         ┌─────────────────────┐       │
    │   │     WORKSPACES      │ 1───n   │  WORKSPACE_MEMBERS  │       │
    │   ├─────────────────────┤         ├─────────────────────┤       │
    │   │ id (PK)             │────────>│ id (PK)             │       │
    │   │ name                │         │ workspaceId (FK)    │       │
    │   │ slug (UNIQUE)       │         │ userId (FK)  ───────│───────│─┐
    │   │ description         │         │ role (ENUM)         │       │ │
    │   │ iconUrl             │         │ nickname            │       │ │
    │   │ ownerId (FK)────────│─────┐   │ joinedAt            │       │ │
    │   │ isPublic            │     │   │ (UNIQUE: workspace  │       │ │
    │   │ inviteCode (UNIQUE) │     │   │  + userId)          │       │ │
    │   │ createdAt           │     │   └─────────────────────┘       │ │
    │   │ updatedAt           │     │                                 │ │
    │   └─────────────────────┘     │                                 │ │
    │             │                 │                                 │ │
    │             │                 └─────────────────────────────────│─│──> USERS
    │             │                                                   │ │
    └─────────────│───────────────────────────────────────────────────┘ │
                  │                                                     │
                  │                                                     │
    ┌─────────────▼─────────────────────────────────────────────────────│───┐
    │                          CHANNELS                                 │   │
    │                                                                   │   │
    │   ┌─────────────────────┐         ┌─────────────────────┐        │   │
    │   │      CHANNELS       │ 1───n   │   CHANNEL_MEMBERS   │        │   │
    │   ├─────────────────────┤         ├─────────────────────┤        │   │
    │   │ id (PK)             │────────>│ id (PK)             │        │   │
    │   │ workspaceId (FK)────│─────┐   │ channelId (FK)      │        │   │
    │   │ name                │     │   │ userId (FK) ────────│────────│───┘
    │   │ description         │     │   │ role (ENUM)         │        │
    │   │ topic               │     │   │ isMuted             │        │
    │   │ type (ENUM)         │     │   │ lastReadAt          │        │
    │   │ isPrivate           │     │   │ lastReadMessageId   │        │
    │   │ isArchived          │     │   │ joinedAt            │        │
    │   │ position            │     │   │ (UNIQUE: channel    │        │
    │   │ createdAt           │     │   │  + userId)          │        │
    │   │ (UNIQUE: workspace  │     │   └─────────────────────┘        │
    │   │  + name)            │     │                                  │
    │   └─────────────────────┘     └───────────────────────────────────│──> WORKSPACES
    │             │                                                    │
    │             │                                                    │
    └─────────────│────────────────────────────────────────────────────┘
                  │
                  │
    ┌─────────────▼────────────────────────────────────────────────────┐
    │                         MESSAGES                                 │
    │                                                                  │
    │   ┌─────────────────────┐         ┌─────────────────────┐       │
    │   │      MESSAGES       │ 1───n   │  MESSAGE_REACTIONS  │       │
    │   ├─────────────────────┤         ├─────────────────────┤       │
    │   │ id (PK)             │────────>│ id (PK)             │       │
    │   │ channelId (FK)──────│─────┐   │ messageId (FK)      │       │
    │   │ userId (FK)─────────│──┐  │   │ userId (FK) ────────│───────│──> USERS
    │   │ content             │  │  │   │ emoji               │       │
    │   │ type (ENUM)         │  │  │   │ createdAt           │       │
    │   │ parentId (FK, self) │──│──│───│ (UNIQUE: message    │       │
    │   │ isEdited            │  │  │   │  + userId + emoji)  │       │
    │   │ editedAt            │  │  │   └─────────────────────┘       │
    │   │ isDeleted           │  │  │                                 │
    │   │ deletedAt           │  │  │   ┌─────────────────────┐       │
    │   │ isPinned            │  │  │   │    ATTACHMENTS      │       │
    │   │ pinnedAt            │  │  │   ├─────────────────────┤       │
    │   │ version             │  │  │   │ id (PK)             │       │
    │   │ createdAt           │  │  │   │ fileName            │       │
    │   │ updatedAt           │  │  └───│ messageId (FK)  <───│───────│───┐
    │   └─────────────────────┘  │      │ directMessageId(FK) │       │   │
    │             │              │      │ uploaderId (FK) ────│───────│───│──> USERS
    │             │              │      │ fileUrl             │       │   │
    │             └──────────────│──────│ fileSize            │       │   │
    │                            │      │ mimeType            │       │   │
    │                            │      │ thumbnailUrl        │       │   │
    │                            │      │ width, height       │       │   │
    │                            │      │ createdAt           │       │   │
    └────────────────────────────│──────┴─────────────────────┴───────┘   │
                                 │                                        │
                                 └───> CHANNELS                           │
                                                                          │
    ┌─────────────────────────────────────────────────────────────────────│──┐
    │                      DIRECT MESSAGES                                │  │
    │                                                                     │  │
    │   ┌─────────────────────┐         ┌─────────────────────┐          │  │
    │   │ DIRECT_CONVERSATIONS│ 1───n   │   DIRECT_MESSAGES   │<─────────┘  │
    │   ├─────────────────────┤         ├─────────────────────┤             │
    │   │ id (PK)             │────────>│ id (PK)             │             │
    │   │ userAId (FK) ───────│─────┐   │ conversationId (FK) │             │
    │   │ userBId (FK) ───────│──┐  │   │ senderId (FK) ──────│─────────────│──> USERS
    │   │ lastMessageAt       │  │  │   │ content             │             │
    │   │ createdAt           │  │  │   │ type (ENUM)         │             │
    │   │ updatedAt           │  │  │   │ isEdited            │             │
    │   │ (UNIQUE: userA      │  │  │   │ isDeleted           │             │
    │   │  + userB)           │  │  │   │ isRead              │             │
    │   └─────────────────────┘  │  │   │ readAt              │             │
    │                            │  │   │ createdAt           │             │
    │                            │  │   │ updatedAt           │             │
    │                            │  │   └─────────────────────┘             │
    │                            │  │                                       │
    │                            │  └───────────────────────────────────────│──> USERS
    │                            │                                          │
    │                            └──────────────────────────────────────────┘
    └───────────────────────────────────────────────────────────────────────┘
```

---

## Table Relationships Summary

### One-to-Many (1:N) Relationships

| Parent Table        | Child Table           | Relationship Description                    |
|--------------------|-----------------------|---------------------------------------------|
| User               | Session               | User can have multiple sessions (devices)   |
| User               | WorkspaceMember       | User can be member of multiple workspaces   |
| User               | ChannelMember         | User can be member of multiple channels     |
| User               | Message               | User can send many messages                 |
| User               | MessageReaction       | User can react to many messages             |
| User               | DirectMessage         | User can send many direct messages          |
| User               | Attachment            | User can upload many files                  |
| Workspace          | WorkspaceMember       | Workspace has many members                  |
| Workspace          | Channel               | Workspace contains many channels            |
| Channel            | ChannelMember         | Channel has many members                    |
| Channel            | Message               | Channel contains many messages              |
| Message            | MessageReaction       | Message can have many reactions             |
| Message            | Attachment            | Message can have many attachments           |
| Message            | Message (self)        | Message can have many replies (threads)     |
| DirectConversation | DirectMessage         | Conversation contains many messages         |

### One-to-One (1:1) Relationships

| Table A | Table B       | Description                              |
|---------|---------------|------------------------------------------|
| User    | UserPresence  | Each user has one presence status record |

### Many-to-Many (M:N) Relationships (via Join Tables)

| Table A   | Table B    | Join Table       | Description                        |
|-----------|------------|------------------|------------------------------------|
| User      | Workspace  | WorkspaceMember  | Users belong to many workspaces    |
| User      | Channel    | ChannelMember    | Users belong to many channels      |

---

## Enums

### UserStatus
```sql
'ONLINE'    -- User is actively using the app
'AWAY'      -- User is idle (no activity for 5+ minutes)
'BUSY'      -- User has set Do Not Disturb
'OFFLINE'   -- User is not connected
```

### ChannelType
```sql
'TEXT'      -- Regular text chat channel
'VOICE'     -- Voice/video call channel
'FORUM'     -- Forum-style threaded discussions
```

### MemberRole
```sql
'OWNER'     -- Full control, can delete
'ADMIN'     -- Can manage members and settings
'MODERATOR' -- Can moderate content
'MEMBER'    -- Regular member
'GUEST'     -- Limited access guest
```

### MessageType
```sql
'TEXT'      -- Regular text message
'IMAGE'     -- Image attachment
'FILE'      -- File attachment
'VIDEO'     -- Video attachment
'AUDIO'     -- Audio message
'SYSTEM'    -- System-generated message
```

---

## Key Design Decisions

### 1. Soft Deletes for Messages
- Messages use `isDeleted` + `deletedAt` instead of hard deletion
- Preserves thread integrity and audit trails
- Content can be replaced with "[deleted]" for display

### 2. Optimistic Locking
- Messages have a `version` field
- Incremented on each update
- Prevents lost updates in concurrent editing scenarios

### 3. DirectConversation Design
- Ensures uniqueness with `userAId < userBId` constraint
- Application logic must enforce this ordering
- Prevents duplicate conversations between same users

### 4. Workspace Hierarchy
```
Workspace
└── Channels
    └── Messages
        ├── Reactions
        └── Attachments
```

### 5. Presence Tracking
- Separate table for real-time status
- Supports multiple socket connections per user
- Updated via WebSocket, not REST

---

## Data Flow Examples

### Sending a Message
```
1. User authenticates (Sessions table)
2. User selects channel (ChannelMember verification)
3. Message created in Messages table
4. Socket.io broadcasts to channel room
5. Client receives and displays message
```

### Direct Message Flow
```
1. Find or create DirectConversation (ensure userA < userB)
2. Create DirectMessage with conversationId
3. Update conversation.lastMessageAt
4. Socket.io notifies recipient
5. Mark as read when recipient views
```

### User Goes Offline
```
1. Socket disconnects
2. Remove socketId from UserPresence.socketIds
3. If socketIds empty, set status = 'OFFLINE'
4. Update lastActiveAt timestamp
5. Broadcast presence change to relevant channels
```
