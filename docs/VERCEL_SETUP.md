# Vercel Deployment Setup

This guide covers deploying ConnectNow to Vercel with a PostgreSQL database.

## Prerequisites

1. A Vercel account
2. A PostgreSQL database (options below)
3. GitHub repository connected to Vercel

## Step 1: Set Up PostgreSQL Database

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel project dashboard
2. Click **Storage** tab
3. Click **Create Database** → **Postgres**
4. Follow prompts to create database
5. Environment variables are automatically added

### Option B: External Database (Supabase, Neon, Railway, etc.)
1. Create a PostgreSQL database on your provider
2. Get the connection string (usually looks like):
   ```
   postgresql://user:password@host:5432/database?sslmode=require
   ```

## Step 2: Configure Environment Variables

Go to **Vercel Project** → **Settings** → **Environment Variables**

Add these variables:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Your PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | Random 32+ character string | Yes |
| `NEXTAUTH_URL` | Your production URL (e.g., `https://your-app.vercel.app`) | Yes |
| `NODE_ENV` | `production` | Auto-set by Vercel |

### Generate NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```
Or use: https://generate-secret.vercel.app/32

### Optional Variables (for OAuth)
| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GITHUB_CLIENT_ID` | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | From GitHub Developer Settings |

## Step 3: Run Database Migrations

After setting environment variables, you need to create the database tables.

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Pull environment variables locally
vercel env pull .env.local

# Run migrations
npx prisma migrate deploy

# (Optional) Seed the database
npm run db:seed
```

### Option B: Using Vercel Functions (One-time Setup)
Create a one-time migration endpoint or use Vercel's build command:

In `vercel.json`:
```json
{
  "build": {
    "env": {
      "DATABASE_URL": "@database_url"
    }
  }
}
```

## Step 4: Deploy

### Automatic Deployment
Push to your main branch - Vercel will automatically deploy.

### Manual Deployment
```bash
vercel --prod
```

## Step 5: Verify Deployment

1. Visit your deployment URL
2. Check the health endpoint: `https://your-app.vercel.app/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": {
    "database": "connected"
  },
  "environment": "production"
}
```

## Troubleshooting

### Build Fails: "Cannot find module '@prisma/client'"
- Ensure `postinstall` script runs `prisma generate`
- Check that `prisma` is in `devDependencies`

### Runtime Error: "Can't reach database server"
- Verify `DATABASE_URL` is set correctly
- Check database allows connections from Vercel IPs
- For Supabase/Neon: Enable "Allow connections from anywhere" or add Vercel IPs

### Error: "Environment variable not found: DATABASE_URL"
- Make sure to set variables for all environments (Production, Preview, Development)
- Redeploy after adding environment variables

### Prisma Migration Errors
```bash
# Reset and re-run migrations (WARNING: deletes all data)
npx prisma migrate reset

# Or push schema without migrations (dev only)
npx prisma db push
```

## Production Checklist

- [ ] `DATABASE_URL` configured
- [ ] `NEXTAUTH_SECRET` set (unique, secure value)
- [ ] `NEXTAUTH_URL` matches deployment URL
- [ ] Database migrations applied
- [ ] Health check returns `"database": "connected"`
- [ ] OAuth providers configured (if using social login)

## Database Connection Pooling

For serverless environments like Vercel, consider using connection pooling:

### With Prisma Data Proxy
```
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
```

### With PgBouncer (Supabase)
Use the connection pooler URL instead of direct connection:
```
DATABASE_URL="postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
```

## Useful Commands

```bash
# View database in browser
npm run db:studio

# Generate Prisma client
npm run db:generate

# Create new migration
npm run db:migrate

# Push schema (no migration history)
npm run db:push

# Seed database
npm run db:seed
```
