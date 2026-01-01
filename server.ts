/**
 * AURA & ECHO - UNIFIED PRODUCTION SERVER
 * Coordinates real-time resonance, presence, and static asset delivery.
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { MongoClient, ServerApiVersion, Collection, Document } from 'mongodb';
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
let dbClient: MongoClient;
let isDbConnected = false;

console.log(`[DATABASE] Attempting connection to: ${MONGODB_URI.split('@').pop()}`);

// Initialize MongoDB connection
async function connectToDatabase() {
  try {
    dbClient = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    
    await dbClient.connect();
    isDbConnected = true;
    console.log('\x1b[32m%s\x1b[0m', '[DATABASE] Connection Established (MongoDB Atlas)');
    
    // Test the connection
    await dbClient.db('admin').command({ ping: 1 });
  } catch (err: any) {
    isDbConnected = false;
    console.warn('\x1b[33m%s\x1b[0m', `[DATABASE] Offline Mode: ${err?.message || 'Unknown error'}`);
    console.log('\x1b[33m%s\x1b[0m', '[DATABASE] Server will continue in Standalone Mode (API results will be empty).');
  }
}

// Initialize the database connection
connectToDatabase();

// Database collections reference
const getDb = () => dbClient.db('sanctuary');
const getEchoesCollection = () => getDb().collection<Document>('echoes');
const getMessagesCollection = () => getDb().collection<Document>('messages');

// --- REST API ENDPOINTS (RESILIENT) ---
app.get('/api/echoes', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.json([]);
    const echoes = await getEchoesCollection()
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json(echoes);
  } catch (err) {
    console.error('Error fetching echoes:', err);
    res.status(500).json({ error: 'Failed to fetch echoes' });
  }
});

app.post('/api/echoes', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.status(503).json({ error: 'DB Offline' });
    
    const echo = req.body;
    if (!echo.id) {
      echo.id = new Date().getTime().toString();
      echo.timestamp = Date.now();
    }
    
    const result = await getEchoesCollection().updateOne(
      { id: echo.id },
      { $set: echo },
      { upsert: true }
    );
    
    res.status(201).json(echo);
  } catch (err) {
    console.error('Error saving echo:', err);
    res.status(400).json({ error: 'Failed to save echo' });
  }
});

app.get('/api/messages/:userId', async (req: any, res: any) => {
  try {
    if (!isDbConnected) return res.json([]);
    
    const messages = await getMessagesCollection()
      .find({
        $or: [
          { senderId: req.params.userId },
          { receiverId: req.params.userId }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();
      
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/health', async (req: any, res: any) => {
  try {
    // Test the database connection
    const dbStatus = isDbConnected ? 'connected' : 'offline';
    
    res.status(200).json({
      status: 'ok',
      database: dbStatus,
      api_key: !!process.env.API_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error?.message || 'Unknown error',
      database: 'error'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing database connections...');
  if (dbClient) {
    await dbClient.close();
  }
  process.exit(0);
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
        await getMessagesCollection().insertOne({
          ...msgData,
          timestamp: Date.now(),
          isRead: false
        });
      } catch (err) {
        console.error('Error saving whisper:', err);
      }
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
 * Using terminal middleware instead of a route pattern to avoid Express 5 path parsing issues.
 */
app.use((req: any, res: any, next: any) => {
  // Only handle GET requests that aren't API calls or static files (no dot in path)
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    const indexPath = path.join(distPath, 'index.html');
    const fallbackPath = path.join(__dirname, 'index.html');
    const finalPath = fs.existsSync(indexPath) ? indexPath : fallbackPath;

    if (fs.existsSync(finalPath)) {
      fs.readFile(finalPath, 'utf8', (err, html) => {
        if (err) {
          res.status(500).send('Sanctuary Loading Error');
          return;
        }
        // Inject API Key into window object for the frontend
        const injection = `<script>window.process = { env: { API_KEY: ${JSON.stringify(process.env.API_KEY || '')} } };</script>`;
        res.send(html.replace('<head>', `<head>${injection}`));
      });
      return;
    }
  }
  next();
});

const PORT = process.env.PORT || 4000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', `[SYSTEM] Sanctuary Engine Online on Port ${PORT}`);
});