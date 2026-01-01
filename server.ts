import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MongoClient, ServerApiVersion, Collection, Db, Document } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

// ES Modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions
interface User {
  socketId: string;
  userId: string;
  name: string;
  isSpeaking: boolean;
}

interface Message extends Document {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  isRead: boolean;
}

interface Echo extends Document {
  id: string;
  content: string;
  userId: string;
  timestamp: number;
}

// Initialize Express app
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

// Database connection
let dbClient: MongoClient;
let db: Db;
let isDbConnected = false;
const activeRooms = new Map<string, Map<string, User>>();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Database connection
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

// Database collections
function getCollection<T extends Document>(name: string): Collection<T> {
  if (!isDbConnected) {
    throw new Error('Database not connected');
  }
  return db.collection<T>(name);
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API Endpoints
app.get('/api/echoes', async (_req: Request, res: Response) => {
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

app.post('/api/echoes', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.status(503).json({ error: 'Database unavailable' });
      return;
    }

    const echo: Echo = {
      id: req.body.id || Date.now().toString(),
      content: req.body.content || '',
      userId: req.body.userId || '',
      timestamp: Date.now()
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

app.get('/api/messages/:userId', async (req: Request, res: Response): Promise<void> => {
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

// Graceful shutdown
const shutdown = async () => {
  console.log('🛑 Shutting down server...');
  
  // Close WebSocket connections
  io.close(() => {
    console.log('WebSocket server closed');
  });

  // Close database connection
  if (isDbConnected && dbClient) {
    await dbClient.close();
    console.log('Database connection closed');
  }

  // Close HTTP server
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// WebSocket connection handling
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

  socket.on('send_whisper', async (msgData: Omit<Message, 'timestamp' | 'isRead'>) => {
    const message: Message = {
      senderId: msgData.senderId || '',
      receiverId: msgData.receiverId || '',
      content: msgData.content || '',
      timestamp: Date.now(),
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

// Serve static files from the dist directory
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Handle SPA routing - serve index.html for all other routes
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
async function startServer() {
  await connectToDatabase();
  
  httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${SERVER_PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log(`💾 Database: ${isDbConnected ? 'Connected' : 'Disconnected'}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});