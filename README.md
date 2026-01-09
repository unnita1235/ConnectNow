# 💬 ConnectNow - Real-Time Messaging Platform

[![Status](https://img.shields.io/badge/status-in_development-orange)](https://github.com/unnita1235/ConnectNow)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

> Modern communication platform combining instant messaging, video conferencing, and team collaboration

**Live Demo:** https://connect-now-phi.vercel.app  
**Status:** Frontend deployed, backend integration in progress

---

## 📸 Screenshots

### Channel Collaboration
<p align="center">
  <img src="screenshots/channel_design.png" alt="Channel Design" width="45%">
  <img src="screenshots/channel_general.png" alt="General Channel" width="45%">
</p>

### Direct Messaging & AI Features
<p align="center">
  <img src="screenshots/direct_message.png" alt="Direct Messages" width="45%">
  <img src="screenshots/smart_features.png" alt="AI Features" width="45%">
</p>
## Overview

ConnectNow is an all-in-one communication platform designed for remote teams, featuring real-time chat, video calls, and team collaboration tools. Built with Next.js, Socket.io, and WebRTC.

---

## Key Features

### Messaging
- 💬 Real-time chat with typing indicators
- 📎 File sharing (drag-and-drop)
- 😊 Rich text with Markdown support
- 🔔 Smart notifications
- ⭐ Message reactions
- 📌 Pinned messages

### Video & Audio (Planned)
- 📹 HD video calls (up to 50 participants planned)
- 🖥️ Screen sharing
- 🎙️ Background noise cancellation
- 📊 Virtual backgrounds
- 🎬 Recording with transcription

### Team Collaboration
- 📂 Channel organization
- 🔒 Private groups
- 👥 User presence tracking
- 🤖 Webhook integrations
- 📊 Activity feeds

### UI/UX
- 🌙 Dark mode support
- 📱 Mobile responsive
- ♿ WCAG 2.1 accessibility
- 🎨 Modern, clean interface

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- React Hook Form

**Backend (Planned/In Progress)**
- Node.js + Socket.io
- PostgreSQL (database)
- Redis (caching)
- Prisma ORM
- NextAuth.js

**Video Infrastructure (Planned)**
- WebRTC (peer-to-peer)
- Simple-peer
- TURN/STUN servers
- Janus media server

---

## Architecture

```
┌──────────────────┐
│  Next.js         │
│  Frontend        │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌─▼────┐
│  Auth  │ │ API  │
│Service │ │Routes│
└───┬────┘ └──┬───┘
    │         │
┌───▼─────────▼──┐
│  Socket.io     │
│  Server        │
└────────┬───────┘
         │
    ┌────┴─────┐
    │          │
┌───▼──┐  ┌───▼────┐
│Redis │  │Postgres│
└──────┘  └────────┘
```

---

## Getting Started

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

# Start Socket.io server (when implemented)
npm run socket
```

Open http://localhost:3000

---

## Project Structure

```
ConnectNow/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, signup
│   │   ├── channels/        # Channel pages
│   │   ├── direct-messages/ # DM pages
│   │   ├── video/           # Video call room
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── chat/            # Message components
│   │   ├── video/           # Video UI
│   │   ├── sidebar/         # Navigation
│   │   └── ui/              # shadcn components
│   ├── lib/
│   │   ├── socket/          # Socket.io client
│   │   ├── webrtc/          # WebRTC helpers
│   │   └── utils/
│   └── store/               # Zustand stores
├── server/                   # Socket.io server
│   ├── index.js
│   ├── handlers/
│   └── utils/
└── package.json
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/connectnow"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication (when implemented)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Socket.io
SOCKET_SERVER_URL="http://localhost:3001"

# WebRTC
STUN_SERVER="stun:stun.l.google.com:19302"
TURN_SERVER="turn:your-turn-server.com:3478"
```

---

## Current Status

### ✅ Implemented
- Chat UI design
- Real-time messaging architecture (designed)
- File upload UI
- Responsive layout
- Component structure

### 🚧 In Progress
- User authentication
- Socket.io integration
- Message persistence
- Channel management

### 📅 Planned
- Video calls (WebRTC)
- Screen sharing
- Push notifications
- Message search
- End-to-end encryption

---

## Roadmap

### Phase 1 (Months 1-2)
- [x] Chat UI design
- [x] Real-time messaging design
- [ ] User authentication
- [ ] Channel management
- [ ] File upload backend

### Phase 2 (Months 3-4)
- [ ] Video calls (1-on-1)
- [ ] Screen sharing
- [ ] Message reactions
- [ ] User presence

### Phase 3 (Months 5-6)
- [ ] Group video calls
- [ ] Recording
- [ ] Message search
- [ ] Push notifications

### Phase 4 (Months 7+)
- [ ] End-to-end encryption
- [ ] Mobile apps
- [ ] Bot framework
- [ ] Large meetings (50+ users)

---

## Technical Highlights

**Planned Optimizations:**
- Sub-second latency with Socket.io + Redis
- Scalable video with P2P/SFU architecture
- Smart caching for 90%+ hit rate
- PWA with offline support
- Full accessibility support

---

## Key Challenges & Solutions

### Challenge 1: Scaling WebSocket Connections
**Planned Solution:** Socket.io Redis adapter for horizontal scaling

### Challenge 2: Video Quality on Poor Networks
**Planned Solution:** Adaptive bitrate, simulcast

### Challenge 3: Message Ordering
**Planned Solution:** Vector clocks + timestamp ordering

---

## Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Contributing

This is a personal learning project demonstrating modern real-time communication architecture. Feedback welcome via GitHub issues.

---

## License

MIT License

---

## Author

**Unni T A**
- GitHub: [@unnita1235](https://github.com/unnita1235)
- Email: unnita1235@gmail.com

---

## Acknowledgments

- Socket.io team
- Simple-peer
- shadcn/ui

---

**ConnectNow** - Building the Future of Team Communication

*Note: Active development project. Video calling and backend integration in progress. Current deployment showcases frontend design and architecture.*
