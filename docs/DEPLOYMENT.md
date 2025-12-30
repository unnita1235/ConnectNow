# Deployment Guide

This guide covers deploying ConnectNow to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Vercel    │    │   Railway   │    │  Supabase   │         │
│  │  (Next.js)  │◄──►│ (Socket.IO) │◄──►│ (Postgres)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                    ┌───────┴───────┐                           │
│                    │   Cloudinary  │                           │
│                    │   (Storage)   │                           │
│                    └───────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- GitHub account (for CI/CD)
- Vercel account (Frontend hosting)
- Railway account (Socket.IO server)
- Supabase/Neon account (PostgreSQL)
- Cloudinary account (File uploads)
- Optional: Upstash (Redis for Socket.IO adapter)

---

## Step 1: Database Setup

### Option A: Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings → Database
3. Copy the connection string

```env
# .env.production
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

### Option B: Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string from the dashboard

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### Run Migrations

```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-url"

# Deploy migrations
npx prisma migrate deploy
```

---

## Step 2: Deploy Frontend to Vercel

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Via GitHub Integration

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random 32+ character string |
| `NEXTAUTH_URL` | Your production URL (https://...) |
| `JWT_SECRET` | Random 32+ character string |
| `NEXT_PUBLIC_SOCKET_SERVER_URL` | Socket.IO server URL |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

4. Deploy!

---

## Step 3: Deploy Socket.IO Server to Railway

### Via Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Select the repository
4. Configure service:
   - Start command: `npm run socket:start`
   - Port: 3001

### Environment Variables

Set these in Railway:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Same as Vercel |
| `JWT_SECRET` | Same as Vercel |
| `REDIS_URL` | Redis connection (optional) |
| `PORT` | 3001 |
| `ALLOWED_ORIGINS` | Your Vercel URL |

### Generate Domain

1. Go to your service settings
2. Generate a public domain
3. Update `NEXT_PUBLIC_SOCKET_SERVER_URL` in Vercel

---

## Step 4: Configure Cloudinary

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard → API Keys
3. Copy cloud name, API key, and API secret
4. Create an upload preset:
   - Settings → Upload → Upload presets
   - Add preset named `connectnow_uploads`
   - Set to Unsigned
   - Configure folder: `connectnow/`

---

## Step 5: Configure GitHub Actions

### Required Secrets

Go to Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `RAILWAY_TOKEN` | Railway API token |
| `DATABASE_URL` | Production database URL |
| `CODECOV_TOKEN` | (Optional) Codecov token |
| `SNYK_TOKEN` | (Optional) Snyk token |

### Get Vercel IDs

```bash
vercel link
cat .vercel/project.json
```

### Get Railway Token

1. Go to Railway dashboard
2. Account → Tokens
3. Create new token

---

## Step 6: DNS & SSL

### Custom Domain on Vercel

1. Go to Vercel project → Settings → Domains
2. Add your domain
3. Configure DNS records as shown

### Custom Domain on Railway

1. Go to Railway service → Settings → Domains
2. Add your domain
3. Configure CNAME record

---

## Environment Variables Summary

### Vercel (Frontend)

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.com
JWT_SECRET=your-jwt-secret

# Socket.IO
NEXT_PUBLIC_SOCKET_SERVER_URL=https://socket.your-domain.com

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional
REDIS_URL=redis://...
```

### Railway (Socket.IO)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://...
PORT=3001
ALLOWED_ORIGINS=https://your-domain.com
```

---

## Monitoring & Logging

### Vercel Analytics

Enable in Vercel dashboard for:
- Web Vitals
- Function invocations
- Error tracking

### Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### LogRocket (Session Replay)

```bash
npm install logrocket
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
npx prisma db pull

# Check migrations
npx prisma migrate status
```

### Socket.IO Not Connecting

1. Check CORS origins in socket server
2. Verify JWT_SECRET matches between services
3. Check Railway logs for errors

### Build Failures

1. Check Prisma generate runs before build
2. Verify all env vars are set
3. Check TypeScript errors locally first

---

## Rollback Procedure

### Vercel

```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-id]
```

### Railway

1. Go to Deployments tab
2. Click on previous deployment
3. Click "Redeploy"

### Database

```bash
# Rollback last migration (development only!)
npx prisma migrate reset

# For production, create a new migration that reverses changes
```

---

## Security Checklist

- [ ] All secrets are in environment variables
- [ ] HTTPS enabled everywhere
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] SQL injection prevented (Prisma handles this)
- [ ] XSS prevention (React handles this)
- [ ] CSRF tokens for mutations
- [ ] Content Security Policy headers
- [ ] Regular dependency updates
