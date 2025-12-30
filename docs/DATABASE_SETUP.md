# Database Setup Guide

This guide covers setting up the database for local development and production deployment.

## Prerequisites

- Docker Desktop (recommended) or local PostgreSQL 15+
- Node.js 18+ and npm/pnpm
- Redis (for Socket.io)

---

## Option 1: Docker (Recommended)

The easiest way to get started is using Docker Compose.

### 1. Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Or with dev tools (Adminer, Redis Commander, MailHog)
docker-compose --profile dev-tools up -d
```

### 2. Verify Services

```bash
# Check running containers
docker-compose ps

# PostgreSQL should be on port 5432
# Redis should be on port 6379
```

### 3. Configure Environment

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

The default Docker settings work out of the box:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/connectnow_dev"
REDIS_URL="redis://localhost:6379"
```

---

## Option 2: Local PostgreSQL

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@16

# Start service
brew services start postgresql@16

# Create database
createdb connectnow_dev
```

### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres createuser --interactive
sudo -u postgres createdb connectnow_dev
```

### Windows

Download and install from: https://www.postgresql.org/download/windows/

Then create the database:
```powershell
psql -U postgres
CREATE DATABASE connectnow_dev;
```

---

## Database Migration

### 1. Generate Prisma Client

```bash
npm run db:generate
```

### 2. Run Migrations

**Development** (creates migration files):
```bash
npm run db:migrate
```

**Production** (applies existing migrations):
```bash
npm run db:migrate:deploy
```

### 3. Seed Test Data (Development Only)

```bash
npm run db:seed
```

This creates:
- 5 test users
- Sample workspaces and channels
- Example messages

### Test User Credentials

After seeding, you can log in with:

| Username | Email | Password |
|----------|-------|----------|
| john_doe | john@example.com | password123 |
| jane_smith | jane@example.com | password123 |
| bob_wilson | bob@example.com | password123 |
| alice_johnson | alice@example.com | password123 |
| charlie_brown | charlie@example.com | password123 |

---

## Prisma Studio

View and edit data with Prisma's visual editor:

```bash
npm run db:studio
```

Opens at: http://localhost:5555

---

## Common Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create a new migration
npm run db:migrate

# Push schema without migration (development)
npm run db:push

# Reset database (WARNING: destroys all data)
npm run db:reset

# Open Prisma Studio
npm run db:studio

# Deploy migrations to production
npm run db:migrate:deploy
```

---

## Database Schema Overview

The database includes these main models:

| Model | Description |
|-------|-------------|
| User | User accounts with auth |
| Session | NextAuth.js sessions |
| Workspace | Team/server containers |
| WorkspaceMember | User membership in workspaces |
| Channel | Text/voice channels |
| ChannelMember | Channel permissions |
| Message | Channel messages |
| MessageReaction | Emoji reactions |
| DirectConversation | DM threads |
| DirectMessage | Direct messages |
| UserPresence | Online status |
| Attachment | File uploads |

See `prisma/DATABASE_SCHEMA.md` for the full entity relationship diagram.

---

## Production Deployment

### Recommended Providers

1. **Supabase** (Recommended)
   - Free tier available
   - Built-in connection pooling
   - Dashboard for management

2. **Neon**
   - Serverless PostgreSQL
   - Automatic scaling
   - Branching support

3. **Railway**
   - Simple deployment
   - Good for staging environments

4. **PlanetScale** (MySQL alternative)
   - If you prefer MySQL

### Connection Pooling

For production, use a connection pooler. Update your `.env`:

```env
# Pooled connection (for application)
DATABASE_URL="postgresql://user:pass@pooler.example.com:5432/db?pgbouncer=true"

# Direct connection (for migrations only)
DIRECT_URL="postgresql://user:pass@direct.example.com:5432/db"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Running Migrations in Production

```bash
# On your production server or CI/CD pipeline
npx prisma migrate deploy
```

---

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
docker-compose ps
# or
brew services list | grep postgresql
```

### Permission Denied

```bash
# Grant permissions to user
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE connectnow_dev TO your_user;
```

### Migration Failed

```bash
# Reset and start fresh (development only!)
npm run db:reset
npm run db:migrate
npm run db:seed
```

### Prisma Client Out of Sync

```bash
# Regenerate client
npm run db:generate
```

---

## Backup & Restore

### Backup

```bash
# Using Docker
docker exec connectnow-postgres pg_dump -U postgres connectnow_dev > backup.sql

# Local PostgreSQL
pg_dump -U postgres connectnow_dev > backup.sql
```

### Restore

```bash
# Using Docker
docker exec -i connectnow-postgres psql -U postgres connectnow_dev < backup.sql

# Local PostgreSQL
psql -U postgres connectnow_dev < backup.sql
```
