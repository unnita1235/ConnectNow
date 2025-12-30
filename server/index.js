const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS Configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Socket.io server is running' });
});

// Store connected users
const users = new Map();
const rooms = new Map();

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins
  socket.on('user:join', (data) => {
    users.set(socket.id, {
      id: socket.id,
      username: data.username,
      status: 'online',
      connectedAt: new Date(),
    });
    io.emit('user:online', { userId: socket.id, username: data.username });
    console.log(`User ${data.username} joined`);
  });

  // Real-time messaging
  socket.on('message:send', (data) => {
    io.emit('message:new', {
      id: Date.now(),
      sender: data.sender,
      content: data.content,
      channel: data.channel,
      timestamp: new Date(),
    });
    console.log(`Message from ${data.sender}: ${data.content}`);
  });

  // Typing indicator
  socket.on('message:typing', (data) => {
    socket.broadcast.emit('typing:start', {
      userId: socket.id,
      username: data.username,
      channel: data.channel,
    });
  });

  socket.on('message:stopped-typing', (data) => {
    socket.broadcast.emit('typing:stop', {
      userId: socket.id,
    });
  });

  // Channel operations
  socket.on('channel:join', (data) => {
    socket.join(data.channelId);
    io.to(data.channelId).emit('channel:user-joined', {
      userId: socket.id,
      channelId: data.channelId,
      username: data.username,
    });
    console.log(`User ${data.username} joined channel ${data.channelId}`);
  });

  socket.on('channel:leave', (data) => {
    socket.leave(data.channelId);
    io.to(data.channelId).emit('channel:user-left', {
      userId: socket.id,
      channelId: data.channelId,
    });
  });

  // Video call signaling
  socket.on('call:initiate', (data) => {
    io.to(data.targetUserId).emit('call:incoming', {
      callerId: socket.id,
      callerName: data.callerName,
    });
  });

  socket.on('call:answer', (data) => {
    io.to(data.callerId).emit('call:answered', {
      answererId: socket.id,
    });
  });

  socket.on('call:reject', (data) => {
    io.to(data.callerId).emit('call:rejected', {
      rejecterId: socket.id,
    });
  });

  socket.on('call:end', (data) => {
    if (data.targetUserId) {
      io.to(data.targetUserId).emit('call:ended', {
        endedBy: socket.id,
      });
    }
  });

  // WebRTC signaling
  socket.on('webrtc:offer', (data) => {
    io.to(data.targetUserId).emit('webrtc:offer', {
      from: socket.id,
      offer: data.offer,
    });
  });

  socket.on('webrtc:answer', (data) => {
    io.to(data.targetUserId).emit('webrtc:answer', {
      from: socket.id,
      answer: data.answer,
    });
  });

  socket.on('webrtc:ice-candidate', (data) => {
    io.to(data.targetUserId).emit('webrtc:ice-candidate', {
      from: socket.id,
      candidate: data.candidate,
    });
  });

  // User disconnects
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('user:offline', { userId: socket.id, username: user.username });
      console.log(`User ${user.username} disconnected`);
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
