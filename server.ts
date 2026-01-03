import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MongoClient, ServerApiVersion, Collection, Db, Document } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

/**
 * AURA & ECHO - PRODUCTION ENGINE
 * Refactored for extreme stability in Express 5 environments.
 */

// ES Modules __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- INTERFACES ---
interface User {
  socketId: string;
  userId: string;
  name: string;
  isSpeaking: boolean;
}

interface Message extends Document {
  senderId: string;
  receiverId: string;
  cipherText: string;
  timestamp: number;
  type: string;
  sharedCircleId?: string;
  isRead: boolean;
}

interface Echo extends Document {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  timestamp: number;
  stats: {
    reads: number;
    likes: number;
    plays: number;
  };
  tags: string[];
}

// --- BOOTSTRAP ---
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const SERVER_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sanctuary';
const NODE_ENV = process.env.NODE_ENV || 'development';

let dbClient: MongoClient;
let db: Db;
let isDbConnected = false;
const activeRooms = new Map<string, Map<string, User>>();

// --- MIDDLEWARES ---
app.use(cors() as any);
app.use(express.json());

// Logger - Fixed type errors for req.path and req.method
app.use((req: any, _res: any, next: NextFunction) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// --- DATABASE ---
async function connectToDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB Mesh...');
    dbClient = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    await dbClient.connect();
    db = dbClient.db();
    isDbConnected = true;
    console.log('✅ MongoDB Mesh Connected');
    await db.command({ ping: 1 });
  } catch (error) {
    isDbConnected = false;
    console.error('❌ MongoDB Mesh Connection Failure:', error);
    console.warn('⚠️ Sanctuary operating in Local-Only mode.');
  }
}

function getCollection<T extends Document>(name: string): Collection<T> {
  if (!isDbConnected) throw new Error('Sanctuary Database Offline');
  return db.collection<T>(name);
}

// --- API ROUTES ---

app.get('/health', (_req: any, res: any) => {
  res.json({
    status: 'online',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/echoes', async (_req: any, res: any) => {
  try {
    const echoes = isDbConnected 
      ? await getCollection<Echo>('echoes').find().sort({ timestamp: -1 }).limit(50).toArray()
      : [];
    res.json(echoes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch echoes' });
  }
});

app.post('/api/echoes', async (req: any, res: any): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.status(503).json({ error: 'Sync unavailable' });
      return;
    }
    const echo: Echo = {
      id: req.body.id || Date.now().toString(),
      authorId: req.body.authorId || '',
      authorName: req.body.authorName || '',
      title: req.body.title || '',
      content: req.body.content || '',
      timestamp: req.body.timestamp || Date.now(),
      stats: req.body.stats || { reads: 0, likes: 0, plays: 0 },
      tags: req.body.tags || []
    };
    await getCollection<Echo>('echoes').updateOne({ id: echo.id }, { $set: echo }, { upsert: true });
    res.status(201).json(echo);
  } catch (error) {
    res.status(400).json({ error: 'Invalid echo broadcast' });
  }
});

app.get('/api/messages/:userId', async (req: any, res: any): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.json([]);
      return;
    }
    const messages = await getCollection<Message>('messages')
      .find({ $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }] })
      .sort({ timestamp: 1 })
      .toArray();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Whisper history unreachable' });
  }
});

// --- SOCKET ENGINE ---
io.on('connection', (socket: Socket) => {
  socket.on('join_circle', ({ roomId, userId, name }) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Map());
    const room = activeRooms.get(roomId)!;
    room.set(socket.id, { socketId: socket.id, userId, name, isSpeaking: false });
    io.to(roomId).emit('presence_update', Array.from(room.values()));
  });

  socket.on('voice_activity', ({ roomId, isSpeaking }) => {
    const room = activeRooms.get(roomId);
    if (room?.has(socket.id)) {
      room.get(socket.id)!.isSpeaking = isSpeaking;
      io.to(roomId).emit('user_speaking', { socketId: socket.id, isSpeaking });
    }
  });

  socket.on('send_whisper', async (msgData: any) => {
    const message: Message = {
      senderId: msgData.senderId || '',
      receiverId: msgData.receiverId || '',
      cipherText: msgData.cipherText || '',
      timestamp: Date.now(),
      type: msgData.type || 'text',
      sharedCircleId: msgData.sharedCircleId,
      isRead: false
    };
    if (isDbConnected) {
      try { await getCollection<Message>('messages').insertOne(message); } catch (e) {}
    }
    io.emit(`whisper_inbox_${msgData.receiverId}`, message);
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((members, roomId) => {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        io.to(roomId).emit('presence_update', Array.from(members.values()));
        if (members.size === 0) activeRooms.delete(roomId);
      }
    });
  });
});

// --- STATIC ASSETS & SPA TERMINATION ---
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

/**
 * WORLD-CLASS SPA FALLBACK
 * We use a terminal middleware instead of a wildcard string ('*') to avoid
 * Express 5 path-to-regexp v8 crashes.
 */
// Fixed type errors for req.path, res.status, res.send
app.use((req: any, res: any) => {
  // Guard: Never serve HTML for missing API endpoints
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found in Sanctuary records' });
  }

  const indexPath = path.join(distPath, 'index.html');
  const rootIndexPath = path.join(__dirname, 'index.html');
  const finalPath = fs.existsSync(indexPath) ? indexPath : rootIndexPath;

  if (fs.existsSync(finalPath)) {
    fs.readFile(finalPath, 'utf8', (err, html) => {
      if (err) return res.status(500).send('Integrity check failed.');
      
      const apiKey = process.env.API_KEY || '';
      const injection = `<script>window.process = { env: { API_KEY: ${JSON.stringify(apiKey)} } };</script>`;
      res.send(html.replace('<head>', `<head>${injection}`));
    });
  } else {
    res.status(404).send('Sanctuary Offline: Core systems missing.');
  }
});

// Global Error Handler - Fixed type errors for res.status and res.json
app.use((err: any, _req: any, res: any, _next: NextFunction) => {
  console.error('Sanctuary Anomaly:', err);
  res.status(500).json({ error: 'Temporal resonance error' });
});

// --- LIFECYCLE ---
const shutdown = async () => {
  console.log('🛑 Shutting down Sanctuary...');
  io.close();
  if (isDbConnected && dbClient) await dbClient.close();
  httpServer.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function startServer() {
  await connectToDatabase();
  httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`🚀 Sanctuary Engine Active on port ${SERVER_PORT}`);
    console.log(`🔑 Key Injection Ready`);
  });
}

startServer().catch(e => {
  console.error('Fatal Sanctuary Start Error:', e);
  process.exit(1);
});