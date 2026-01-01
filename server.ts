/**
 * AURA & ECHO - UNIFIED PRODUCTION SERVER
 * Coordinates real-time resonance, presence, and static asset delivery.
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

// 1. SYSTEM LOGGING & MIDDLEWARE
console.log('\x1b[36m%s\x1b[0m', '--- SANCTUARY ENGINE INITIALIZING ---');

app.use(cors());
app.use(express.json() as any);

app.use((req: any, res: any, next: any) => {
  if (req.path !== '/health') {
    console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  }
  next();
});

// 2. DATABASE CONNECTION
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sanctuary';
let isDbConnected = false;

console.log(`[DATABASE] Attempting connection to: ${MONGODB_URI.split('@').pop()}`);

mongoose.connect(MONGODB_URI)
  .then(() => {
    isDbConnected = true;
    console.log('\x1b[32m%s\x1b[0m', '[DATABASE] Connection Established (Atlas/Local)');
  })
  .catch((err: Error) => {
    isDbConnected = false;
    console.warn('\x1b[33m%s\x1b[0m', `[DATABASE] Offline Mode: ${err.message}`);
    console.log('\x1b[33m%s\x1b[0m', '[DATABASE] Server will continue in Standalone Mode (API results will be empty).');
  });

// --- DATA MODELS ---
const EchoSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  authorId: String,
  authorName: String,
  title: String,
  content: String,
  timestamp: { type: Number, default: Date.now },
  stats: { 
    reads: { type: Number, default: 0 }, 
    likes: { type: Number, default: 0 },
    plays: { type: Number, default: 0 }
  },
  tags: [String]
});
const Echo = mongoose.models.Echo || mongoose.model('Echo', EchoSchema);

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
const MessageModel = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// --- REST API ENDPOINTS (RESILIENT) ---
app.get('/api/echoes', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.json([]);
    const echoes = await Echo.find().sort({ timestamp: -1 }).limit(50);
    res.json(echoes);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/echoes', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.status(503).json({ error: 'DB Offline' });
    const echo = await Echo.findOneAndUpdate({ id: req.body.id } as any, req.body, { upsert: true, new: true });
    res.status(201).json(echo);
  } catch (err) {
    res.status(400).json({ error: 'Broadcast failed' });
  }
});

app.get('/api/messages/:userId', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.json([]);
    const messages = await MessageModel.find({
      $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }]
    } as any).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.json([]);
  }
});

app.get('/health', (req: any, res: any) => {
  res.status(200).json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'offline',
    api_key: !!process.env.API_KEY
  });
});

// --- REAL-TIME MESH (SOCKET.IO) ---
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const activeRooms = new Map<string, Map<string, any>>();

io.on('connection', (socket: Socket) => {
  socket.on('join_circle', ({ roomId, userId, name }: { roomId: string, userId: string, name: string }) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
    const room = activeRooms.get(roomId)!;
    room.set(socket.id, { socketId: socket.id, userId, name, isSpeaking: false });
    io.to(roomId).emit('presence_update', Array.from(room.values()));
  });

  socket.on('voice_activity', ({ roomId, isSpeaking }: { roomId: string, isSpeaking: boolean }) => {
    const room = activeRooms.get(roomId);
    if (room?.has(socket.id)) {
      room.get(socket.id)!.isSpeaking = isSpeaking;
      io.to(roomId).emit('user_speaking', { socketId: socket.id, isSpeaking });
    }
  });

  socket.on('send_whisper', async (msgData: any) => {
    if (isDbConnected) {
      try {
        const msg = new MessageModel(msgData);
        await msg.save();
      } catch (err) {}
    }
    io.emit(`whisper_inbox_${msgData.receiverId}`, msgData);
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((members, roomId) => {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        io.to(roomId).emit('presence_update', Array.from(members.values()));
      }
    });
  });
});

// 4. STATIC ASSETS & SPA FALLBACK
const __dirname = path.resolve();
const distPath = path.join(__dirname, 'dist');

// Serve static assets first
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

/**
 * SPA FALLBACK MIDDLEWARE
 * Using app.use() instead of app.get('*') to bypass Express 5 route string parsing issues.
 */
app.use((req: any, res: any, next: any) => {
  // Only handle GET requests that aren't API calls or static files
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    const indexPath = path.join(distPath, 'index.html');
    const fallbackPath = path.join(__dirname, 'index.html');
    const finalPath = fs.existsSync(indexPath) ? indexPath : fallbackPath;

    if (fs.existsSync(finalPath)) {
      fs.readFile(finalPath, 'utf8', (err, html) => {
        if (err) return res.status(500).send('Sanctuary Loading Error');
        // Inject API Key into window object for the frontend
        const injection = `<script>window.process = { env: { API_KEY: ${JSON.stringify(process.env.API_KEY || '')} } };</script>`;
        res.send(html.replace('<head>', `<head>${injection}`));
      });
    } else {
      res.status(404).send('Sanctuary Entry Not Found');
    }
  } else {
    next();
  }
});

const PORT = process.env.PORT || 4000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', `[SYSTEM] Sanctuary Engine Online on Port ${PORT}`);
});
