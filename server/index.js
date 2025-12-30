/**
 * ConnectNow Socket.io Server
 * Real-time messaging, typing indicators, user presence, and WebRTC signaling
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Socket.io configuration with CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json());

// ==============================================
// In-Memory Data Stores
// ==============================================
const users = new Map();           // socketId -> user data
const channels = new Map();        // channelId -> channel data
const typingUsers = new Map();     // channelId -> Set of usernames typing
const userSockets = new Map();     // odename -> socketId (for DMs)

// ==============================================
// REST API Endpoints
// ==============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ConnectNow Socket.io server is running',
    connections: users.size,
    channels: channels.size,
    uptime: process.uptime(),
  });
});

// Get online users
app.get('/api/users/online', (req, res) => {
  const onlineUsers = Array.from(users.values());
  res.json({ users: onlineUsers, count: onlineUsers.length });
});

// Get channel info
app.get('/api/channels/:channelId', (req, res) => {
  const channel = channels.get(req.params.channelId);
  if (channel) {
    res.json(channel);
  } else {
    res.status(404).json({ error: 'Channel not found' });
  }
});

// ==============================================
// Socket.io Event Handlers
// ==============================================

io.on('connection', (socket) => {
  console.log(`[CONNECT] User connected: ${socket.id}`);

  // ----------------------------------------
  // USER PRESENCE
  // ----------------------------------------

  // User joins the server
  socket.on('user:join', (data) => {
    const userData = {
      id: socket.id,
      odename: data.odename || data.username || `User-${socket.id.slice(0, 6)}`,
      name: data.name || data.odename || data.username,
      avatarUrl: data.avatarUrl || null,
      status: 'online',
      connectedAt: new Date().toISOString(),
    };

    users.set(socket.id, userData);
    userSockets.set(userData.odename, socket.id);

    // Broadcast to all users that someone came online
    io.emit('user:online', userData);

    // Send the new user the list of currently online users
    socket.emit('users:list', Array.from(users.values()));

    console.log(`[USER] ${userData.odename} joined (${users.size} online)`);
  });

  // User updates their status
  socket.on('user:status', (data) => {
    const user = users.get(socket.id);
    if (user) {
      user.status = data.status; // 'online', 'away', 'busy', 'offline'
      users.set(socket.id, user);
      io.emit('user:status-changed', {
        userId: socket.id,
        odename: user.odename,
        status: data.status,
      });
    }
  });

  // ----------------------------------------
  // MESSAGING
  // ----------------------------------------

  // Send a message to a channel
  socket.on('message:send', (data) => {
    const user = users.get(socket.id);
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      author: {
        id: socket.id,
        name: user?.name || data.sender || 'Anonymous',
        odename: user?.odename || data.sender,
        avatarUrl: user?.avatarUrl || data.avatarUrl,
      },
      content: data.content,
      channelId: data.channelId || data.channel,
      timestamp: new Date().toISOString(),
      file: data.file || null,
    };

    // Send to specific channel or broadcast
    if (data.channelId) {
      io.to(data.channelId).emit('message:new', message);
    } else {
      io.emit('message:new', message);
    }

    console.log(`[MESSAGE] ${message.author.name}: ${data.content.substring(0, 50)}...`);
  });

  // Direct message to a specific user
  socket.on('message:direct', (data) => {
    const senderUser = users.get(socket.id);
    const targetSocketId = userSockets.get(data.targetUsername);

    const message = {
      id: `dm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      author: {
        id: socket.id,
        name: senderUser?.name || 'Anonymous',
        odename: senderUser?.odename,
        avatarUrl: senderUser?.avatarUrl,
      },
      content: data.content,
      timestamp: new Date().toISOString(),
      isDirect: true,
    };

    // Send to target user
    if (targetSocketId) {
      io.to(targetSocketId).emit('message:direct', message);
    }
    // Also send back to sender for UI update
    socket.emit('message:direct', message);
  });

  // ----------------------------------------
  // TYPING INDICATORS
  // ----------------------------------------

  socket.on('typing:start', (data) => {
    const user = users.get(socket.id);
    const channelId = data.channelId || 'general';

    if (!typingUsers.has(channelId)) {
      typingUsers.set(channelId, new Set());
    }
    typingUsers.get(channelId).add(user?.odename || data.username);

    socket.broadcast.to(channelId).emit('typing:update', {
      channelId,
      users: Array.from(typingUsers.get(channelId)),
    });

    // Also broadcast globally if no channel specified
    if (!data.channelId) {
      socket.broadcast.emit('typing:update', {
        channelId: 'general',
        users: Array.from(typingUsers.get(channelId)),
        userId: socket.id,
        username: user?.odename || data.username,
      });
    }
  });

  socket.on('typing:stop', (data) => {
    const user = users.get(socket.id);
    const channelId = data.channelId || 'general';

    if (typingUsers.has(channelId)) {
      typingUsers.get(channelId).delete(user?.odename || data.username);

      socket.broadcast.to(channelId).emit('typing:update', {
        channelId,
        users: Array.from(typingUsers.get(channelId)),
      });

      if (!data.channelId) {
        socket.broadcast.emit('typing:update', {
          channelId: 'general',
          users: Array.from(typingUsers.get(channelId)),
          userId: socket.id,
        });
      }
    }
  });

  // ----------------------------------------
  // CHANNEL MANAGEMENT
  // ----------------------------------------

  // Create a new channel
  socket.on('channel:create', (data) => {
    const channelId = data.id || `channel-${Date.now()}`;
    const channel = {
      id: channelId,
      name: data.name,
      description: data.description || '',
      createdBy: socket.id,
      createdAt: new Date().toISOString(),
      members: [socket.id],
    };

    channels.set(channelId, channel);
    socket.join(channelId);

    io.emit('channel:created', channel);
    console.log(`[CHANNEL] Created: ${data.name}`);
  });

  // Join a channel
  socket.on('channel:join', (data) => {
    const user = users.get(socket.id);
    socket.join(data.channelId);

    // Add user to channel members
    const channel = channels.get(data.channelId);
    if (channel && !channel.members.includes(socket.id)) {
      channel.members.push(socket.id);
      channels.set(data.channelId, channel);
    }

    io.to(data.channelId).emit('channel:user-joined', {
      channelId: data.channelId,
      userId: socket.id,
      username: user?.odename || data.username,
      user: user,
    });

    console.log(`[CHANNEL] ${user?.odename || 'User'} joined ${data.channelId}`);
  });

  // Leave a channel
  socket.on('channel:leave', (data) => {
    const user = users.get(socket.id);
    socket.leave(data.channelId);

    // Remove user from channel members
    const channel = channels.get(data.channelId);
    if (channel) {
      channel.members = channel.members.filter(id => id !== socket.id);
      channels.set(data.channelId, channel);
    }

    io.to(data.channelId).emit('channel:user-left', {
      channelId: data.channelId,
      userId: socket.id,
      username: user?.odename,
    });
  });

  // ----------------------------------------
  // VIDEO CALLS (WebRTC Signaling)
  // ----------------------------------------

  // Initiate a call
  socket.on('call:initiate', (data) => {
    const caller = users.get(socket.id);
    const targetSocketId = userSockets.get(data.targetUsername) || data.targetUserId;

    if (targetSocketId) {
      io.to(targetSocketId).emit('call:incoming', {
        callerId: socket.id,
        callerName: caller?.name || data.callerName,
        callerAvatar: caller?.avatarUrl,
        callType: data.callType || 'video', // 'video' or 'audio'
      });
      console.log(`[CALL] ${caller?.name} calling ${data.targetUsername}`);
    }
  });

  // Answer a call
  socket.on('call:answer', (data) => {
    io.to(data.callerId).emit('call:answered', {
      answererId: socket.id,
      answererName: users.get(socket.id)?.name,
    });
  });

  // Reject a call
  socket.on('call:reject', (data) => {
    io.to(data.callerId).emit('call:rejected', {
      rejecterId: socket.id,
      reason: data.reason || 'declined',
    });
  });

  // End a call
  socket.on('call:end', (data) => {
    const targetSocketId = userSockets.get(data.targetUsername) || data.targetUserId;
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:ended', {
        endedBy: socket.id,
        reason: data.reason || 'ended',
      });
    }
  });

  // ----------------------------------------
  // WebRTC Signaling
  // ----------------------------------------

  // Send WebRTC offer
  socket.on('webrtc:offer', (data) => {
    const targetSocketId = userSockets.get(data.targetUsername) || data.targetUserId;
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:offer', {
        from: socket.id,
        fromName: users.get(socket.id)?.name,
        offer: data.offer,
      });
    }
  });

  // Send WebRTC answer
  socket.on('webrtc:answer', (data) => {
    const targetSocketId = userSockets.get(data.targetUsername) || data.targetUserId;
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:answer', {
        from: socket.id,
        answer: data.answer,
      });
    }
  });

  // Send ICE candidate
  socket.on('webrtc:ice-candidate', (data) => {
    const targetSocketId = userSockets.get(data.targetUsername) || data.targetUserId;
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    }
  });

  // ----------------------------------------
  // SCREEN SHARING
  // ----------------------------------------

  socket.on('screen:start', (data) => {
    const user = users.get(socket.id);
    io.to(data.channelId).emit('screen:started', {
      userId: socket.id,
      username: user?.odename,
      channelId: data.channelId,
    });
  });

  socket.on('screen:stop', (data) => {
    io.to(data.channelId).emit('screen:stopped', {
      userId: socket.id,
      channelId: data.channelId,
    });
  });

  // ----------------------------------------
  // REACTIONS & NOTIFICATIONS
  // ----------------------------------------

  socket.on('message:react', (data) => {
    io.emit('message:reaction', {
      messageId: data.messageId,
      reaction: data.reaction,
      userId: socket.id,
      username: users.get(socket.id)?.odename,
    });
  });

  // ----------------------------------------
  // DISCONNECT
  // ----------------------------------------

  socket.on('disconnect', (reason) => {
    const user = users.get(socket.id);

    if (user) {
      // Clean up typing indicators
      typingUsers.forEach((typingSet, channelId) => {
        if (typingSet.has(user.odename)) {
          typingSet.delete(user.odename);
          io.to(channelId).emit('typing:update', {
            channelId,
            users: Array.from(typingSet),
          });
        }
      });

      // Remove from user maps
      userSockets.delete(user.odename);
      users.delete(socket.id);

      // Notify others
      io.emit('user:offline', {
        userId: socket.id,
        odename: user.odename,
        name: user.name,
      });

      console.log(`[DISCONNECT] ${user.odename} left (${reason}) - ${users.size} online`);
    }
  });

  // ----------------------------------------
  // ERROR HANDLING
  // ----------------------------------------

  socket.on('error', (error) => {
    console.error(`[ERROR] Socket ${socket.id}:`, error.message);
  });
});

// ==============================================
// Error Handling Middleware
// ==============================================

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ==============================================
// Start Server
// ==============================================

const PORT = process.env.SOCKET_PORT || process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('   ConnectNow Socket.io Server');
  console.log('========================================');
  console.log(`   Status:  RUNNING`);
  console.log(`   Port:    ${PORT}`);
  console.log(`   Mode:    ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log('========================================');
  console.log('');
});

// ==============================================
// Graceful Shutdown
// ==============================================

const gracefulShutdown = (signal) => {
  console.log(`\n[SHUTDOWN] ${signal} received, closing connections...`);

  // Notify all connected users
  io.emit('server:shutdown', { message: 'Server is restarting...' });

  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log('[SHUTDOWN] Forcing close...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
