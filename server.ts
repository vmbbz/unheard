
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
import fs from 'fs';

const app = express();
const httpServer = createServer(app);

// 1. VITALITY CHECK (HEALTHCHECK) - TOP PRIORITY
app.get('/health', (req: any, res: any) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    database: dbStatus,
    timestamp: Date.now()
  });
});

// 2. MIDDLEWARE CONFIG
app.use(express.json() as any);

const __dirname = path.resolve();
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath) as any);

// 3. DATABASE CONFIGURATION
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
const MessageModel = mongoose.model('Message', MessageSchema);

// --- REST API ---
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
    const messages = await MessageModel.find({
      $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }]
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch whispers' });
  }
});

// --- REAL-TIME COORDINATION (Socket.io) ---
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

interface Member {
  socketId: string;
  userId: string;
  name: string;
  isSpeaking?: boolean;
}

const activeRooms = new Map<string, Map<string, Member>>();

io.on('connection', (socket: Socket) => {
  console.log('[SOCKET] User Connected:', socket.id);

  socket.on('join_circle', ({ roomId, userId, name }: { roomId: string, userId: string, name: string }) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Map());
    }
    const roomMembers = activeRooms.get(roomId)!;
    roomMembers.set(socket.id, { socketId: socket.id, userId, name, isSpeaking: false });
    
    // Broadcast updated presence to all members in that room
    io.to(roomId).emit('presence_update', Array.from(roomMembers.values()));
  });

  socket.on('voice_activity', ({ roomId, isSpeaking }: { roomId: string, isSpeaking: boolean }) => {
    const roomMembers = activeRooms.get(roomId);
    if (roomMembers && roomMembers.has(socket.id)) {
      const member = roomMembers.get(socket.id)!;
      member.isSpeaking = isSpeaking;
      // Broadcast specifically who is speaking
      io.to(roomId).emit('user_speaking', { socketId: socket.id, isSpeaking });
    }
  });

  socket.on('send_whisper', async (msgData: any) => {
    try {
      const msg = new MessageModel(msgData);
      await msg.save();
      // Targeted emit to the specific recipient's listener
      io.emit(`whisper_inbox_${msgData.receiverId}`, msgData);
    } catch (err) {
      console.error('[WHISPER] Broadcast persistence failed');
    }
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((roomMembers, roomId) => {
      if (roomMembers.has(socket.id)) {
        roomMembers.delete(socket.id);
        io.to(roomId).emit('presence_update', Array.from(roomMembers.values()));
        if (roomMembers.size === 0) activeRooms.delete(roomId);
      }
    });
  });
});

// 4. SPA FALLBACK & API_KEY INJECTION
// This middleware catches all non-API GET requests and serves index.html with runtime keys.
app.use((req: any, res: any, next: any) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(distPath, 'index.html');
    const finalPath = fs.existsSync(indexPath) ? indexPath : path.join(__dirname, 'index.html');

    fs.readFile(finalPath, 'utf8', (err, html) => {
      if (err) return res.status(500).send('Sanctuary Initialization Error');

      // Inject the key into the client's window.process object
      const injectedScript = `<script>
        window.process = { env: { 
          API_KEY: ${JSON.stringify(process.env.API_KEY || '')} 
        } };
      </script>`;
      
      const finalHtml = html.replace('<head>', `<head>${injectedScript}`);
      res.send(finalHtml);
    });
  } else {
    next();
  }
});

const PORT = process.env.PORT || 4000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
  ┌──────────────────────────────────────────────────┐
  │   SANCTUARY PRODUCTION ENGINE ACTIVE             │
  │   PORT: ${PORT}                                   │
  │   MAPPING: FULL PRESENCE & WHISPER PERSISTENCE   │
  │   RUNTIME KEY INJECTION: ENABLED                 │
  └──────────────────────────────────────────────────┘
  `);
});
