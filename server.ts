
/**
 * AURA & ECHO - PRODUCTION SERVER
 * Coordinates real-time resonance, presence, and encrypted whisper handshakes.
 * Uses MongoDB for persistent sanctuary logs and user meshes.
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';

const app = express();
// FIX: Cast to any to avoid PathParams overload mismatch in environments where Express types conflict with global Fetch API
app.use(express.json() as any);

// Serve static files from the 'dist' directory (Vite build output)
const __dirname = path.resolve();
// FIX: Cast to any to avoid RequestHandler vs PathParams type mismatch
app.use(express.static(path.join(__dirname, 'dist')) as any);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- DATABASE CONFIGURATION ---
// MongoDB Atlas string goes into this environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sanctuary';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('[DATABASE] Connected to Mesh Storage (MongoDB Atlas)'))
  .catch((err: Error) => console.error('[DATABASE] Connection error:', err));

// --- MODELS ---
const EchoSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  authorId: String,
  authorName: String,
  title: String,
  content: String,
  timestamp: { type: Number, default: Date.now },
  stats: {
    reads: { type: Number, default: 0 },
    likes: { type: Number, default: 0 }
  },
  tags: [String]
});
const Echo = mongoose.model('Echo', EchoSchema);

const MessageSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  senderId: String,
  receiverId: String,
  cipherText: String,
  timestamp: { type: Number, default: Date.now },
  type: { type: String, default: 'text' },
  sharedCircleId: String,
  isRead: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', MessageSchema);

// --- VITALITY CHECK (HEALTHCHECK) ---
// FIX: Using any for req/res to bypass local type conflicts with global Fetch API Request/Response
app.get('/health', (req: any, res: any) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    database: dbStatus,
    timestamp: Date.now()
  });
});

// --- REST API ---
// FIX: Using any for req/res to resolve missing property errors (status, json, body, params)
app.get('/api/echoes', async (req: any, res: any) => {
  try {
    const echoes = await Echo.find().sort({ timestamp: -1 }).limit(50);
    res.json(echoes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch echoes' });
  }
});

app.post('/api/echoes', async (req: any, res: any) => {
  try {
    const echoData = req.body;
    const echo = await Echo.findOneAndUpdate(
      { id: echoData.id },
      echoData,
      { upsert: true, new: true }
    );
    res.status(201).json(echo);
  } catch (err) {
    res.status(400).json({ error: 'Failed to save echo' });
  }
});

app.get('/api/messages/:userId', async (req: any, res: any) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }]
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch whispers' });
  }
});

// --- REAL-TIME COORDINATION (Socket.io) ---
interface Member {
  socketId: string;
  userId: string;
  name: string;
  isSpeaking?: boolean;
}

interface RoomState {
  members: Map<string, Member>;
}

const activeRooms = new Map<string, RoomState>();

io.on('connection', (socket: Socket) => {
  socket.on('join_circle', ({ roomId, userId, name }: { roomId: string, userId: string, name: string }) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, { members: new Map() });
    }
    const room = activeRooms.get(roomId)!;
    room.members.set(socket.id, { socketId: socket.id, userId, name });
    io.to(roomId).emit('presence_update', Array.from(room.members.values()));
  });

  socket.on('send_whisper', async (msgData: any) => {
    try {
      const msg = new Message(msgData);
      await msg.save();
      io.emit(`whisper_inbox_${msgData.receiverId}`, msgData);
    } catch (err) {
      console.error('[WHISPER] Broadcast failed');
    }
  });

  socket.on('voice_activity', ({ roomId, isSpeaking }: { roomId: string, isSpeaking: boolean }) => {
    const room = activeRooms.get(roomId);
    if (room && room.members.has(socket.id)) {
      const member = room.members.get(socket.id)!;
      member.isSpeaking = isSpeaking;
      io.to(roomId).emit('user_speaking', { socketId: socket.id, isSpeaking });
    }
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((room, roomId) => {
      if (room.members.has(socket.id)) {
        room.members.delete(socket.id);
        io.to(roomId).emit('presence_update', Array.from(room.members.values()));
        if (room.members.size === 0) activeRooms.delete(roomId);
      }
    });
  });
});

// FIX: Express 5.x SPA Fallback. 
// Instead of using string patterns like '*' or '/:path*', we use a RegExp literal.
// This is the most compatible way to catch all routes in Express 5.
app.get(/.*/, (req: any, res: any) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────────────┐
  │   SANCTUARY PRODUCTION ENGINE ACTIVE             │
  │   PORT: ${PORT}                                   │
  │   HEALTHCHECK: /health                           │
  └──────────────────────────────────────────────────┘
  `);
});
