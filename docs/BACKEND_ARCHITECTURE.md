# ConnectNow Backend Architecture

## Table of Contents
1. [Database Relationship Diagram](#database-relationship-diagram)
2. [API Folder Structure](#api-folder-structure)
3. [API Endpoints](#api-endpoints)
4. [Database Indexing Strategy](#database-indexing-strategy)
5. [Migration Strategy](#migration-strategy)
6. [Performance Optimization Notes](#performance-optimization-notes)

---

## Database Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CONNECTNOW DATABASE SCHEMA                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │  VerificationToken│
                              │──────────────────│
                              │ identifier       │
                              │ token            │
                              │ expires          │
                              └──────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│     Account      │         │       User       │         │     Session      │
│──────────────────│         │──────────────────│         │──────────────────│
│ id           PK  │────────▶│ id           PK  │◀────────│ id           PK  │
│ userId       FK  │         │ email        UK  │         │ userId       FK  │
│ type             │         │ name             │         │ sessionToken UK  │
│ provider         │         │ displayName      │         │ expires          │
│ providerAccountId│         │ avatarUrl        │         └──────────────────┘
│ refresh_token    │         │ bio              │
│ access_token     │         │ status           │         ┌──────────────────┐
│ expires_at       │         │ lastSeenAt       │         │  UserPreferences │
└──────────────────┘         │ role             │         │──────────────────│
                             │ createdAt        │◀────────│ id           PK  │
                             │ updatedAt        │         │ userId       FK  │
                             └────────┬─────────┘         │ emailNotif       │
                                      │                   │ pushNotif        │
        ┌─────────────────────────────┼─────────────────────────────────────────┐
        │                             │                                         │
        ▼                             ▼                                         ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────────┐
│  ChannelMember   │         │     Channel      │         │ DirectMessageThread  │
│──────────────────│         │──────────────────│         │──────────────────────│
│ id           PK  │         │ id           PK  │         │ id               PK  │
│ channelId    FK  │────────▶│ name             │         │ createdBy        FK  │
│ userId       FK  │         │ slug         UK  │         │ lastMessageAt        │
│ role             │         │ description      │         │ createdAt            │
│ muted            │         │ type             │         └──────────┬───────────┘
│ joinedAt         │         │ avatarUrl        │                    │
│ leftAt           │         │ createdById      │                    ▼
└──────────────────┘         │ archivedAt       │         ┌──────────────────────┐
                             └──────────────────┘         │ DMParticipant        │
                                      │                   │──────────────────────│
                                      │                   │ id               PK  │
                                      ▼                   │ threadId         FK  │
                             ┌──────────────────┐         │ userId           FK  │
                             │     Message      │         │ muted                │
                             │──────────────────│         │ archived             │
                             │ id           PK  │         └──────────────────────┘
                             │ channelId    FK  │                    │
                             │ authorId     FK  │                    ▼
                             │ content          │         ┌──────────────────────┐
                             │ type             │         │   DirectMessage      │
                             │ parentId     FK  │◀─┐      │──────────────────────│
                             │ deletedAt        │  │      │ id               PK  │
                             │ editedAt         │  │      │ threadId         FK  │
                             │ version          │  │      │ authorId         FK  │
                             └────────┬─────────┘  │      │ content              │
                                      │            │      │ type                 │
        ┌─────────────────────────────┼────────────┘      │ replyToId        FK  │◀─┐
        │                             │                   │ deletedAt            │  │
        ▼                             ▼                   │ editedAt             │  │
┌──────────────────┐         ┌──────────────────┐         └──────────┬───────────┘  │
│   FileUpload     │         │ MessageReaction  │                    │              │
│──────────────────│         │──────────────────│                    └──────────────┘
│ id           PK  │         │ id           PK  │                  (self-ref replies)
│ uploaderId   FK  │         │ userId       FK  │
│ fileName         │         │ emoji            │
│ mimeType         │         │ messageId    FK  │         ┌──────────────────┐
│ fileType         │         │ directMsgId  FK  │         │    Mention       │
│ size             │         └──────────────────┘         │──────────────────│
│ url              │                                      │ id           PK  │
│ messageId    FK  │                                      │ userId       FK  │
│ directMsgId  FK  │                                      │ messageId    FK  │
└──────────────────┘                                      │ directMsgId  FK  │
                                                          │ readAt           │
┌──────────────────┐         ┌──────────────────┐         └──────────────────┘
│   ReadReceipt    │         │ TypingIndicator  │
│──────────────────│         │──────────────────│         ┌──────────────────┐
│ id           PK  │         │ id           PK  │         │   Notification   │
│ userId       FK  │         │ userId       FK  │         │──────────────────│
│ messageId    FK  │         │ channelId        │         │ id           PK  │
│ readAt           │         │ threadId         │         │ userId       FK  │
└──────────────────┘         │ expiresAt        │         │ type             │
                             └──────────────────┘         │ title            │
                                                          │ body             │
┌──────────────────┐                                      │ isUrgent         │
│    AuditLog      │                                      │ readAt           │
│──────────────────│                                      └──────────────────┘
│ id           PK  │
│ userId       FK  │
│ action           │
│ entityType       │
│ entityId         │
│ metadata         │
└──────────────────┘

LEGEND:
  PK = Primary Key
  FK = Foreign Key
  UK = Unique Key
  ──▶ = One-to-Many relationship
  ◀── = Many-to-One relationship
```

### Relationship Summary

| Parent | Child | Relationship | Description |
|--------|-------|--------------|-------------|
| User | Account | 1:N | OAuth providers (Google, GitHub, etc.) |
| User | Session | 1:N | Active login sessions |
| User | ChannelMember | 1:N | Channel memberships |
| User | Message | 1:N | Authored messages |
| User | DirectMessage | 1:N | Authored DMs |
| Channel | ChannelMember | 1:N | Channel membership |
| Channel | Message | 1:N | Messages in channel |
| Message | Message | 1:N | Thread replies (self-ref) |
| Message | FileUpload | 1:N | Attached files |
| Message | MessageReaction | 1:N | Emoji reactions |
| DirectMessageThread | DirectMessageParticipant | 1:N | Thread participants |
| DirectMessageThread | DirectMessage | 1:N | Messages in thread |

---

## API Folder Structure

```
src/
├── app/
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts          # NextAuth.js handler
│       │
│       ├── users/
│       │   ├── route.ts              # GET (list), POST (create)
│       │   ├── [userId]/
│       │   │   ├── route.ts          # GET, PATCH, DELETE
│       │   │   ├── status/
│       │   │   │   └── route.ts      # PATCH (update online status)
│       │   │   └── preferences/
│       │   │       └── route.ts      # GET, PATCH
│       │   └── me/
│       │       └── route.ts          # GET current user
│       │
│       ├── channels/
│       │   ├── route.ts              # GET (list), POST (create)
│       │   └── [channelId]/
│       │       ├── route.ts          # GET, PATCH, DELETE
│       │       ├── messages/
│       │       │   ├── route.ts      # GET (paginated), POST
│       │       │   └── [messageId]/
│       │       │       ├── route.ts  # GET, PATCH, DELETE
│       │       │       ├── reactions/
│       │       │       │   └── route.ts  # POST, DELETE
│       │       │       └── replies/
│       │       │           └── route.ts  # GET thread replies
│       │       ├── members/
│       │       │   ├── route.ts      # GET, POST (invite)
│       │       │   └── [userId]/
│       │       │       └── route.ts  # PATCH (role), DELETE (kick)
│       │       ├── typing/
│       │       │   └── route.ts      # POST (typing indicator)
│       │       └── read/
│       │           └── route.ts      # POST (mark as read)
│       │
│       ├── dm/
│       │   ├── route.ts              # GET (list threads), POST (create)
│       │   └── [threadId]/
│       │       ├── route.ts          # GET thread details
│       │       ├── messages/
│       │       │   ├── route.ts      # GET (paginated), POST
│       │       │   └── [messageId]/
│       │       │       ├── route.ts  # GET, PATCH, DELETE
│       │       │       └── reactions/
│       │       │           └── route.ts
│       │       ├── participants/
│       │       │   └── route.ts      # GET, POST (add), DELETE (leave)
│       │       └── typing/
│       │           └── route.ts
│       │
│       ├── messages/
│       │   └── search/
│       │       └── route.ts          # GET (full-text search)
│       │
│       ├── files/
│       │   ├── route.ts              # POST (upload)
│       │   └── [fileId]/
│       │       └── route.ts          # GET, DELETE
│       │
│       ├── notifications/
│       │   ├── route.ts              # GET (list)
│       │   ├── read/
│       │   │   └── route.ts          # POST (mark read)
│       │   └── [notificationId]/
│       │       └── route.ts          # DELETE
│       │
│       ├── socket/
│       │   └── route.ts              # WebSocket upgrade handler
│       │
│       └── health/
│           └── route.ts              # Health check endpoint
│
├── lib/
│   ├── db.ts                         # Prisma client singleton
│   ├── auth.ts                       # NextAuth configuration
│   ├── socket.ts                     # Socket.io server setup
│   ├── validators/                   # Zod schemas
│   │   ├── user.ts
│   │   ├── channel.ts
│   │   ├── message.ts
│   │   └── index.ts
│   ├── services/                     # Business logic
│   │   ├── user.service.ts
│   │   ├── channel.service.ts
│   │   ├── message.service.ts
│   │   ├── dm.service.ts
│   │   ├── notification.service.ts
│   │   └── file.service.ts
│   └── utils/
│       ├── api-response.ts           # Standardized responses
│       ├── errors.ts                 # Custom error classes
│       └── pagination.ts             # Cursor pagination helpers
│
└── types/
    ├── api.ts                        # API request/response types
    └── socket.ts                     # Socket event types
```

---

## API Endpoints

### Authentication (NextAuth.js)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth.js handler | - |

### Users

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/users` | `?search=&limit=20&cursor=` | `{ users: User[], nextCursor }` | List users |
| POST | `/api/users` | Body: `{ email, name }` | `User` | Create user (admin) |
| GET | `/api/users/me` | - | `User` | Get current user |
| GET | `/api/users/[userId]` | - | `User` | Get user by ID |
| PATCH | `/api/users/[userId]` | Body: `{ name?, avatarUrl?, bio? }` | `User` | Update user |
| DELETE | `/api/users/[userId]` | - | `{ success: true }` | Delete user |
| PATCH | `/api/users/[userId]/status` | Body: `{ status: UserStatus }` | `User` | Update status |
| GET | `/api/users/[userId]/preferences` | - | `UserPreferences` | Get preferences |
| PATCH | `/api/users/[userId]/preferences` | Body: `Partial<UserPreferences>` | `UserPreferences` | Update prefs |

### Channels

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/channels` | `?type=&limit=20&cursor=` | `{ channels: Channel[], nextCursor }` | List channels |
| POST | `/api/channels` | Body: `{ name, slug, description?, type? }` | `Channel` | Create channel |
| GET | `/api/channels/[channelId]` | - | `Channel` | Get channel |
| PATCH | `/api/channels/[channelId]` | Body: `{ name?, description? }` | `Channel` | Update channel |
| DELETE | `/api/channels/[channelId]` | - | `{ success: true }` | Archive channel |

### Channel Messages

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/channels/[channelId]/messages` | `?limit=50&cursor=&before=&after=` | `{ messages: Message[], nextCursor, prevCursor }` | Get messages (cursor pagination) |
| POST | `/api/channels/[channelId]/messages` | Body: `{ content, type?, parentId?, fileIds? }` | `Message` | Send message |
| GET | `/api/channels/[channelId]/messages/[messageId]` | - | `Message` | Get single message |
| PATCH | `/api/channels/[channelId]/messages/[messageId]` | Body: `{ content }` + Header: `If-Match: version` | `Message` | Edit message (optimistic lock) |
| DELETE | `/api/channels/[channelId]/messages/[messageId]` | - | `{ success: true }` | Soft delete |
| GET | `/api/channels/[channelId]/messages/[messageId]/replies` | `?limit=20&cursor=` | `{ replies: Message[], nextCursor }` | Get thread |
| POST | `/api/channels/[channelId]/messages/[messageId]/reactions` | Body: `{ emoji }` | `Reaction` | Add reaction |
| DELETE | `/api/channels/[channelId]/messages/[messageId]/reactions` | `?emoji=` | `{ success: true }` | Remove reaction |

### Channel Members

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/channels/[channelId]/members` | - | `ChannelMember[]` | List members |
| POST | `/api/channels/[channelId]/members` | Body: `{ userId }` | `ChannelMember` | Add member |
| PATCH | `/api/channels/[channelId]/members/[userId]` | Body: `{ role?, muted? }` | `ChannelMember` | Update role |
| DELETE | `/api/channels/[channelId]/members/[userId]` | - | `{ success: true }` | Remove member |

### Channel Utilities

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| POST | `/api/channels/[channelId]/typing` | - | `{ success: true }` | Broadcast typing |
| POST | `/api/channels/[channelId]/read` | Body: `{ messageId }` | `{ success: true }` | Mark as read |

### Direct Messages

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/dm` | `?limit=20&cursor=` | `{ threads: DMThread[], nextCursor }` | List DM threads |
| POST | `/api/dm` | Body: `{ participantIds: string[] }` | `DMThread` | Create/get thread |
| GET | `/api/dm/[threadId]` | - | `DMThread` | Get thread details |
| GET | `/api/dm/[threadId]/messages` | `?limit=50&cursor=` | `{ messages: DM[], nextCursor }` | Get messages |
| POST | `/api/dm/[threadId]/messages` | Body: `{ content, type?, replyToId? }` | `DirectMessage` | Send DM |
| PATCH | `/api/dm/[threadId]/messages/[messageId]` | Body: `{ content }` | `DirectMessage` | Edit DM |
| DELETE | `/api/dm/[threadId]/messages/[messageId]` | - | `{ success: true }` | Soft delete |
| POST | `/api/dm/[threadId]/typing` | - | `{ success: true }` | Typing indicator |
| GET | `/api/dm/[threadId]/participants` | - | `Participant[]` | List participants |
| DELETE | `/api/dm/[threadId]/participants` | - | `{ success: true }` | Leave thread |

### Search

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/messages/search` | `?q=&channelId=&authorId=&from=&to=&limit=20` | `{ results: Message[], total }` | Full-text search |

### Files

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| POST | `/api/files` | FormData: `file` | `FileUpload` | Upload file |
| GET | `/api/files/[fileId]` | - | `FileUpload` | Get file metadata |
| DELETE | `/api/files/[fileId]` | - | `{ success: true }` | Delete file |

### Notifications

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/notifications` | `?unreadOnly=&limit=20&cursor=` | `{ notifications: Notification[], nextCursor, unreadCount }` | List notifications |
| POST | `/api/notifications/read` | Body: `{ ids: string[] }` | `{ success: true }` | Mark as read |
| DELETE | `/api/notifications/[notificationId]` | - | `{ success: true }` | Delete notification |

### System

| Method | Endpoint | Parameters | Response | Description |
|--------|----------|------------|----------|-------------|
| GET | `/api/health` | - | `{ status: 'ok', db: 'connected' }` | Health check |

---

## Database Indexing Strategy

### Primary Indexes (Auto-created by Prisma)
- All `@id` fields have primary key indexes
- All `@unique` fields have unique indexes

### Performance-Critical Indexes

```prisma
// USER QUERIES
@@index([email])              // Login lookups
@@index([status])             // Online user listings
@@index([lastSeenAt])         // Recently active users

// MESSAGE QUERIES (Most Critical)
@@index([channelId, createdAt])           // Channel message feed
@@index([channelId, deletedAt, createdAt]) // Feed with soft deletes
@@index([authorId])                        // User's messages
@@index([parentId])                        // Thread lookups
@@index([createdAt])                       // Global timeline

// DM QUERIES
@@index([threadId, createdAt])   // DM message feed
@@index([lastMessageAt(sort: Desc)]) // Sort conversations

// NOTIFICATION QUERIES
@@index([userId, readAt])        // Unread notifications
@@index([userId, createdAt])     // Notification history
@@index([isUrgent])              // AI-filtered urgent

// READ TRACKING
@@index([userId, messageId])     // Read receipt lookups

// AUDIT/COMPLIANCE
@@index([entityType, entityId])  // Entity history
@@index([action])                // Action filtering
```

### Index Optimization Notes

1. **Composite Indexes**: Order matters! Put high-cardinality columns first.
   - `[channelId, createdAt]` - Good for channel feeds
   - `[createdAt, channelId]` - Bad, scans all dates first

2. **Covering Indexes**: For read-heavy queries, consider:
   ```sql
   CREATE INDEX idx_messages_feed ON messages(channel_id, created_at)
   INCLUDE (author_id, content, type);
   ```

3. **Partial Indexes**: For soft deletes:
   ```sql
   CREATE INDEX idx_messages_active ON messages(channel_id, created_at)
   WHERE deleted_at IS NULL;
   ```

4. **Expression Indexes**: For case-insensitive search:
   ```sql
   CREATE INDEX idx_users_email_lower ON users(LOWER(email));
   ```

---

## Migration Strategy

### Phase 1: Database Setup

```bash
# Install dependencies
npm install @prisma/client prisma

# Initialize Prisma
npx prisma init

# Create initial migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### Phase 2: Seed Data Migration

Create `/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { currentUser, users, channels, directMessages } from '../src/lib/data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create users from hardcoded data
  const createdUsers = await Promise.all(
    users.map(user =>
      prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: `${user.name.toLowerCase().replace(' ', '.')}@connectnow.app`,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status === 'online' ? 'ONLINE' : 'OFFLINE',
        },
      })
    )
  );
  console.log(`✅ Created ${createdUsers.length} users`);

  // 2. Create channels
  for (const channel of channels) {
    const created = await prisma.channel.upsert({
      where: { slug: channel.name.replace('#', '') },
      update: {},
      create: {
        id: channel.id,
        name: channel.name.replace('#', ''),
        slug: channel.name.replace('#', ''),
        type: 'PUBLIC',
        createdById: currentUser.id,
      },
    });

    // Add current user as member
    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId: created.id,
          userId: currentUser.id,
        },
      },
      update: {},
      create: {
        channelId: created.id,
        userId: currentUser.id,
        role: 'OWNER',
      },
    });

    // 3. Create messages for each channel
    for (const msg of channel.messages) {
      await prisma.message.create({
        data: {
          id: msg.id,
          channelId: created.id,
          authorId: msg.author.id,
          content: msg.content,
          type: msg.file ? 'FILE' : 'TEXT',
          createdAt: new Date(msg.timestamp),
        },
      });
    }
  }
  console.log(`✅ Created ${channels.length} channels with messages`);

  // 4. Create DM threads
  for (const dm of directMessages) {
    const thread = await prisma.directMessageThread.create({
      data: {
        id: dm.id,
        createdBy: currentUser.id,
      },
    });

    // Add participants
    for (const participant of dm.participants) {
      await prisma.directMessageParticipant.create({
        data: {
          threadId: thread.id,
          userId: participant.id,
        },
      });
    }

    // Add messages
    for (const msg of dm.messages) {
      await prisma.directMessage.create({
        data: {
          threadId: thread.id,
          authorId: msg.author.id,
          content: msg.content,
          createdAt: new Date(msg.timestamp),
        },
      });
    }
  }
  console.log(`✅ Created ${directMessages.length} DM threads`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Phase 3: Example Migrations

**Migration 1: Add message pinning**
```bash
npx prisma migrate dev --name add_message_pinning
```

```prisma
// Add to Message model
model Message {
  // ... existing fields
  isPinned  Boolean   @default(false) @map("is_pinned")
  pinnedAt  DateTime? @map("pinned_at")
  pinnedBy  String?   @map("pinned_by")
}
```

**Migration 2: Add channel categories**
```bash
npx prisma migrate dev --name add_channel_categories
```

```prisma
model ChannelCategory {
  id        String    @id @default(cuid())
  name      String
  position  Int       @default(0)
  channels  Channel[]

  @@map("channel_categories")
}

model Channel {
  // ... existing fields
  categoryId String? @map("category_id")
  position   Int     @default(0)

  category ChannelCategory? @relation(fields: [categoryId], references: [id])
}
```

**Migration 3: Add message search with tsvector**
```bash
npx prisma migrate dev --name add_fulltext_search
```

```sql
-- migrations/XXXXXX_add_fulltext_search/migration.sql
ALTER TABLE messages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_messages_search ON messages USING GIN(search_vector);
```

---

## Performance Optimization Notes

### 1. Connection Pooling

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 2. Query Optimization

```typescript
// BAD: N+1 query problem
const messages = await prisma.message.findMany({ where: { channelId } });
for (const msg of messages) {
  const author = await prisma.user.findUnique({ where: { id: msg.authorId } });
}

// GOOD: Single query with include
const messages = await prisma.message.findMany({
  where: { channelId, deletedAt: null },
  include: {
    author: { select: { id: true, name: true, avatarUrl: true, status: true } },
    reactions: { include: { user: { select: { id: true, name: true } } } },
    files: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

### 3. Cursor Pagination (Infinite Scroll)

```typescript
// src/lib/utils/pagination.ts
export async function paginateMessages(channelId: string, cursor?: string) {
  const messages = await prisma.message.findMany({
    where: { channelId, deletedAt: null },
    take: 51, // Fetch one extra to check if more exist
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
    orderBy: { createdAt: 'desc' },
    include: { author: true, reactions: true, files: true },
  });

  const hasMore = messages.length > 50;
  const items = hasMore ? messages.slice(0, 50) : messages;

  return {
    messages: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
```

### 4. Optimistic Locking for Concurrent Updates

```typescript
// Prevent lost updates when multiple users edit
async function updateMessage(id: string, content: string, expectedVersion: number) {
  const result = await prisma.message.updateMany({
    where: { id, version: expectedVersion },
    data: {
      content,
      editedAt: new Date(),
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new ConflictError('Message was modified by another user');
  }

  return prisma.message.findUnique({ where: { id } });
}
```

### 5. Soft Delete Query Patterns

```typescript
// Always filter out deleted messages
const activeMessages = await prisma.message.findMany({
  where: {
    channelId,
    deletedAt: null, // Soft delete filter
  },
});

// For admin: include deleted with flag
const allMessages = await prisma.message.findMany({
  where: { channelId },
  select: {
    id: true,
    content: true,
    deletedAt: true,
    isDeleted: prisma.raw`deleted_at IS NOT NULL`,
  },
});
```

### 6. Batch Operations

```typescript
// Mark multiple notifications as read
await prisma.notification.updateMany({
  where: {
    userId,
    id: { in: notificationIds },
  },
  data: { readAt: new Date() },
});
```

### 7. Socket.io Integration

```typescript
// src/lib/socket.ts
import { Server as SocketServer } from 'socket.io';
import { prisma } from './db';

export function setupSocketHandlers(io: SocketServer) {
  io.on('connection', async (socket) => {
    const userId = socket.handshake.auth.userId;

    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE', lastSeenAt: new Date() },
    });

    // Join user's channels
    const memberships = await prisma.channelMember.findMany({
      where: { userId, leftAt: null },
      select: { channelId: true },
    });
    memberships.forEach(m => socket.join(`channel:${m.channelId}`));

    // Handle new message
    socket.on('message:send', async (data) => {
      const message = await prisma.message.create({
        data: { ...data, authorId: userId },
        include: { author: true },
      });

      // Broadcast to channel
      io.to(`channel:${data.channelId}`).emit('message:new', message);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() },
      });
      io.emit('user:status', { userId, status: 'OFFLINE' });
    });
  });
}
```

### 8. Caching Strategy (Redis)

```typescript
// For frequently accessed data
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache channel member count
async function getChannelMemberCount(channelId: string) {
  const cached = await redis.get(`channel:${channelId}:members`);
  if (cached) return parseInt(cached);

  const count = await prisma.channelMember.count({
    where: { channelId, leftAt: null },
  });

  await redis.setex(`channel:${channelId}:members`, 300, count); // 5min TTL
  return count;
}

// Invalidate on membership change
async function invalidateChannelCache(channelId: string) {
  await redis.del(`channel:${channelId}:members`);
}
```

---

## Environment Variables

```env
# .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/connectnow?schema=public"
NEXTAUTH_SECRET="your-super-secret-key"
NEXTAUTH_URL="http://localhost:9002"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Redis (optional, for caching)
REDIS_URL="redis://localhost:6379"

# File uploads (e.g., S3, Cloudinary)
UPLOAD_PROVIDER="local" # or "s3", "cloudinary"
UPLOAD_MAX_SIZE_MB=10
```

---

## Next Steps

1. Run `npm install @prisma/client prisma socket.io next-auth`
2. Run `npx prisma migrate dev --name init`
3. Run `npx prisma db seed`
4. Create API route files following the structure above
5. Implement Socket.io server in `/src/lib/socket.ts`
6. Update frontend to use API calls instead of hardcoded data
