import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MongoClient, ServerApiVersion, Collection, Db, Document } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

/**
 * AURA & ECHO - STABLE PRODUCTION SERVER
 * Refactored for Express 5 + MongoDB + Socket.io
 */

// ES Modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- TYPE DEFINITIONS ---
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

// --- INITIALIZATION ---
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configuration
const SERVER_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sanctuary';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database state
let dbClient: MongoClient;
let db: Db;
let isDbConnected = false;
const activeRooms = new Map<string, Map<string, User>>();

// --- MIDDLEWARE ---
// Casting to any to bypass Express 5 RequestHandler type conflicts in specific environments
app.use(cors() as any);
app.use(express.json());

// Request logging
// Fix: Explicitly cast middleware to any to prevent Express 5 from misinterpreting it as PathParams
app.use(((req: any, _res: any, next: NextFunction) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
}) as any);

// --- DATABASE LOGIC ---
async function connectToDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
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
    console.log('✅ Connected to MongoDB');
    
    // Test the connection
    await db.command({ ping: 1 });
  } catch (error) {
    isDbConnected = false;
    console.error('❌ MongoDB connection error:', error);
    console.warn('⚠️  Running in offline mode - database features disabled');
  }
}

function getCollection<T extends Document>(name: string): Collection<T> {
  if (!isDbConnected) {
    throw new Error('Database not connected');
  }
  return db.collection<T>(name);
}

// --- API ENDPOINTS ---

// Health check
app.get('/health', (_req: any, res: any) => {
  res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Fetch Echoes
app.get('/api/echoes', async (_req: any, res: any) => {
  try {
    const echoes = isDbConnected 
      ? await getCollection<Echo>('echoes')
          .find()
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray()
      : [];
    res.json(echoes);
  } catch (error) {
    console.error('Error fetching echoes:', error);
    res.status(500).json({ error: 'Failed to fetch echoes' });
  }
});

// Save Echo
app.post('/api/echoes', async (req: any, res: any): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.status(503).json({ error: 'Database unavailable' });
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

    await getCollection<Echo>('echoes').updateOne(
      { id: echo.id },
      { $set: echo },
      { upsert: true }
    );

    res.status(201).json(echo);
  } catch (error) {
    console.error('Error saving echo:', error);
    res.status(400).json({ error: 'Failed to save echo' });
  }
});

// Fetch Whispers
app.get('/api/messages/:userId', async (req: any, res: any): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.json([]);
      return;
    }
    
    const messages = await getCollection<Message>('messages')
      .find({
        $or: [
          { senderId: req.params.userId },
          { receiverId: req.params.userId }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();
      
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// --- WEBSOCKET ENGINE ---
io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_circle', ({ roomId, userId, name }) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Map());
    }
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
      try {
        await getCollection<Message>('messages').insertOne(message);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    }

    io.emit(`whisper_inbox_${msgData.receiverId}`, message);
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((members, roomId) => {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        io.to(roomId).emit('presence_update', Array.from(members.values()));
        if (members.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// --- STATIC FILES ---
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// --- SPA FALLBACK (BIGGER THINKING) ---
/**
 * Instead of using a wildcard route like '*' or '/:path*' which can crash 
 * the Express 5 parser if not perfectly escaped, we use a terminal middleware.
 * This matches EVERYTHING that wasn't caught by the routes or static middleware above.
 */
// Fix: Cast SPA fallback middleware to any to satisfy Express 5 type checking
app.use(((req: any, res: any, next: NextFunction) => {
  // If it's an API request that didn't match anything, 404 it
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found in Sanctuary records' });
  }

  // Otherwise, serve the SPA index
  const indexPath = path.join(distPath, 'index.html');
  const rootIndexPath = path.join(__dirname, 'index.html');
  const finalPath = fs.existsSync(indexPath) ? indexPath : rootIndexPath;

  if (fs.existsSync(finalPath)) {
    fs.readFile(finalPath, 'utf8', (err, html) => {
      if (err) {
        return res.status(500).send('Sanctuary Loading Error: Integrity check failed.');
      }
      
      // Inject API_KEY at runtime so frontend can access it via process.env.API_KEY
      const apiKey = process.env.API_KEY || '';
      const injection = `<script>window.process = { env: { API_KEY: ${JSON.stringify(apiKey)} } };</script>`;
      const processedHtml = html.replace('<head>', `<head>${injection}`);
      
      res.send(processedHtml);
    });
  } else {
    // If no index found, we are in a broken state
    res.status(404).send('Sanctuary Offline: Core systems missing.');
  }
}) as any);

// --- ERROR HANDLING ---
// Fix: Added explicit 'any' cast and simplified signature to ensure Express 5 recognizes this as an error handler
app.use(((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled Sanctuary Crash:', err);
  res.status(500).json({ error: 'The Sanctuary engine has encountered a temporal anomaly.' });
}) as any);

// --- LIFECYCLE ---
const shutdown = async () => {
  console.log('🛑 Shutting down Sanctuary...');
  io.close();
  if (isDbConnected && dbClient) {
    await dbClient.close();
  }
  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function startServer() {
  await connectToDatabase();
  
  httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`🚀 Sanctuary Active on port ${SERVER_PORT}`);
    console.log(`💾 Mode: ${NODE_ENV}`);
    console.log(`🔑 API Key Configured: ${process.env.API_KEY ? 'YES' : 'NO'}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer().catch((error) => {
  console.error('Failed to initiate Sanctuary:', error);
  process.exit(1);
});
