// ============================================
// NOC WebSocket Service
// Real-time notifications for alarms, logs, tasks
// Port: 3003
// ============================================

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Types
interface WSClient {
  id: string;
  userId?: string;
  roles?: string[];
  subscriptions: Set<string>;
  connectedAt: Date;
}

// In-memory client store
const clients: Map<string, WSClient> = new Map();

// Create HTTP server
const httpServer = new HttpServer();

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/',
});

// Authentication middleware
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = socket.handshake.auth.userId;
  const roles = socket.handshake.auth.roles;

  // In production, validate JWT token here
  if (token) {
    clients.set(socket.id, {
      id: socket.id,
      userId,
      roles: roles?.split(',') || ['viewer'],
      subscriptions: new Set(['alarms', 'logs', 'tasks', 'system']),
      connectedAt: new Date(),
    });
    next();
  } else {
    // Allow anonymous connections with viewer role
    clients.set(socket.id, {
      id: socket.id,
      roles: ['viewer'],
      subscriptions: new Set(['alarms']),
      connectedAt: new Date(),
    });
    next();
  }
});

// Connection handler
io.on('connection', (socket: Socket) => {
  const client = clients.get(socket.id);
  console.log(`[WS] Client connected: ${socket.id}, User: ${client?.userId || 'anonymous'}`);

  // Send initial status
  socket.emit('connected', {
    message: 'Connected to NOC WebSocket Service',
    clientId: socket.id,
    timestamp: new Date(),
  });

  // Subscribe to channels
  socket.on('subscribe', (channels: string[]) => {
    const client = clients.get(socket.id);
    if (client) {
      channels.forEach(ch => client.subscriptions.add(ch));
      socket.emit('subscribed', { channels, timestamp: new Date() });
      console.log(`[WS] Client ${socket.id} subscribed to: ${channels.join(', ')}`);
    }
  });

  // Unsubscribe from channels
  socket.on('unsubscribe', (channels: string[]) => {
    const client = clients.get(socket.id);
    if (client) {
      channels.forEach(ch => client.subscriptions.delete(ch));
      socket.emit('unsubscribed', { channels, timestamp: new Date() });
    }
  });

  // Handle alarm acknowledgments from dashboard
  socket.on('alarm:acknowledge', async (data: { alarmId: string; userId: string }) => {
    console.log(`[WS] Alarm acknowledgment request: ${data.alarmId}`);
    // Broadcast to all subscribers
    io.emit('alarm:updated', {
      alarmId: data.alarmId,
      action: 'acknowledged',
      by: data.userId,
      timestamp: new Date(),
    });
  });

  // Handle provisioning task updates
  socket.on('task:update', (data: { taskId: string; status: string }) => {
    console.log(`[WS] Task update: ${data.taskId} -> ${data.status}`);
    io.emit('task:updated', {
      taskId: data.taskId,
      status: data.status,
      timestamp: new Date(),
    });
  });

  // Handle ping
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    clients.delete(socket.id);
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Broadcast helper functions
export function broadcastAlarm(alarm: Record<string, unknown>) {
  io.emit('alarm:new', alarm);
  console.log(`[WS] Broadcasted alarm: ${alarm.id}`);
}

export function broadcastLog(log: Record<string, unknown>) {
  io.emit('log:new', log);
}

export function broadcastTaskUpdate(taskId: string, status: string, result?: unknown) {
  io.emit('task:updated', {
    taskId,
    status,
    result,
    timestamp: new Date(),
  });
}

export function broadcastSystemNotification(message: string, severity: string) {
  io.emit('system:notification', {
    message,
    severity,
    timestamp: new Date(),
  });
}

// API endpoint for receiving events from main app
// POST /internal endpoint would be handled by a simple HTTP server
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';

const apiHandler = (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/internal/broadcast') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { type, payload } = data;

        switch (type) {
          case 'alarm':
            broadcastAlarm(payload);
            break;
          case 'log':
            broadcastLog(payload);
            break;
          case 'task':
            broadcastTaskUpdate(payload.taskId, payload.status, payload.result);
            break;
          case 'notification':
            broadcastSystemNotification(payload.message, payload.severity);
            break;
          default:
            io.emit(type, payload);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
};

// Start server on port 3003
const PORT = 3003;

// Attach HTTP handler for API
httpServer.on('request', apiHandler);

httpServer.listen(PORT, () => {
  console.log(`[NOC WebSocket] Server running on port ${PORT}`);
  console.log(`[NOC WebSocket] Socket.IO path: /`);
  console.log(`[NOC WebSocket] Internal API: /internal/broadcast`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[NOC WebSocket] Shutting down...');
  io.close(() => {
    httpServer.close(() => {
      console.log('[NOC WebSocket] Server closed');
      process.exit(0);
    });
  });
});
