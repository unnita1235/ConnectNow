# 💬 ConnectNow

[![Status](https://img.shields.io/badge/status-in_development-orange)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

> **Real-time Messaging Platform** with video calls, screen sharing, and team collaboration

A modern communication platform combining instant messaging, video conferencing, and team collaboration tools. Built for remote teams and communities.

---

## 🎯 The Problem

Remote teams struggle with:
- 📞 **Scattered Communication**: Email, Slack, Zoom, WhatsApp (tool fatigue)
- 💰 **Expensive Solutions**: $15-30/user/month for enterprise tools
- 🐌 **Poor Performance**: Laggy interfaces, dropped calls
- 🔒 **Privacy Concerns**: Data shared with big tech

**ConnectNow** provides an all-in-one, performant, and affordable solution.

---

## ✨ Key Features

### Messaging
- 💬 **Real-time Chat**: Instant messaging with typing indicators
- 🔔 **Smart Notifications**: Desktop + mobile push notifications
- 📎 **File Sharing**: Drag-and-drop file uploads (images, docs, videos)
- 😊 **Rich Text**: Markdown support, emojis, GIFs
- 🔍 **Message Search**: Full-text search across conversations
- ⭐ **Reactions**: Emoji reactions to messages
- 📌 **Pinned Messages**: Pin important messages to channel

### Video & Audio
- 📹 **HD Video Calls**: 1080p video conferencing (up to 50 participants)
- 🖥️ **Screen Sharing**: Share entire screen or specific application
- 🎙️ **Background Noise Cancellation**: AI-powered audio filtering
- 📊 **Virtual Backgrounds**: Custom backgrounds or blur
- 🎬 **Recording**: Record meetings with transcription

### Team Collaboration
- 📂 **Channels**: Organize conversations by topic/project
- 🔒 **Private Groups**: Secure channels with invite-only access
- 👥 **User Presence**: See who's online/away/busy
- 🤖 **Bot Integration**: Webhooks for GitHub, Jira, etc.
- 📊 **Activity Feed**: See what's happening across channels

### Advanced Features
- 🌙 **Dark Mode**: Easy on the eyes
- 📱 **Mobile Responsive**: Works on all devices
- 🔐 **End-to-End Encryption**: Secure messaging (planned)
- 🌍 **Multi-language**: Support for 10+ languages (planned)
- ♿ **Accessibility**: WCAG 2.1 compliant

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Real-time**: Socket.io client
- **Video**: WebRTC + Simple-peer
- **State Management**: Zustand
- **Forms**: React Hook Form

### Backend
- **API**: Next.js API Routes
- **Real-time Server**: Node.js + Socket.io
- **Database**: PostgreSQL
- **Cache**: Redis (online status, typing indicators)
- **ORM**: Prisma
- **Auth**: NextAuth.js (email, Google, GitHub)
- **File Storage**: AWS S3 / Cloudinary

### Video Infrastructure
- **WebRTC**: Peer-to-peer video
- **TURN Server**: Coturn (NAT traversal)
- **STUN Server**: Google STUN servers
- **Media Server**: Janus (for large meetings, planned)

### DevOps
- **Hosting**: Vercel (Frontend), Railway (Backend)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + LogRocket
- **CDN**: Cloudflare

---

## 📐 System Architecture
```
┌──────────────────────────────────────────────────┐
│            Next.js Frontend                      │
│  (Chat UI, Video Calls, Channels)                │
└────────────────────┬─────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
   │  Auth   │  │  API   │  │  CDN   │
   │ Service │  │ Routes │  │ (Files)│
   └────┬────┘  └───┬────┘  └────────┘
        │           │
        └─────┬─────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐      ┌──────▼──────┐
│Socket  │      │ PostgreSQL  │
│.io     │◀────▶│  (Messages) │
│Server  │      └─────────────┘
└───┬────┘
    │
┌───▼────┐
│ Redis  │
│(Cache) │
└────────┘

┌──────────────────────┐
│   WebRTC P2P Video   │
│  (User ↔ User)       │
└──────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis (for local development)

### Installation
```bash
# Clone repository
git clone https://github.com/unnita1235/ConnectNow.git
cd ConnectNow

# Install dependencies
npm install

# Start Redis (in separate terminal)
redis-server

# Setup environment
cp .env.example .env.local

# Run development server
npm run dev

# In another terminal, start Socket.io server
npm run socket
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure
