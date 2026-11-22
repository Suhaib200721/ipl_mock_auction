import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { INITIAL_TEAMS } from '../src/data/teamsData';
import { INITIAL_PLAYERS } from '../src/data/playersData';
import { DEFAULT_RULES } from '../src/utils/currencyUtils';
import { setupMultiplayerSocket } from './multiplayer';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Production CORS Configuration for Vercel & Render
const allowedOriginsEnv = (
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  process.env.ALLOWED_ORIGINS ||
  ''
).trim();

const configuredOrigins = allowedOriginsEnv
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true; // Allow non-browser requests
  if (configuredOrigins.length === 0 || configuredOrigins.includes('*')) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (/^https?:\/\/.*\.vercel\.app$/.test(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all multiplayer connections safely
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));

// Setup Socket.IO Server with cloud-ready keep-alive and CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 15000,
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log(`[IO CONNECTION ${new Date().toISOString()}] Socket ${socket.id} connected (transport=${socket.conn.transport.name})`);
});

setupMultiplayerSocket(io);

// Serve built frontend assets if dist directory exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    project: 'IPL 2027 Mock Auction Simulator',
    tagline: 'Build Your Dream IPL Squad.',
    stage: 'Stage 2 (Single Player & Real-Time Multiplayer)',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/teams', (_req: Request, res: Response) => {
  res.json({ teams: INITIAL_TEAMS });
});

app.get('/api/players', (_req: Request, res: Response) => {
  res.json({ players: INITIAL_PLAYERS, total: INITIAL_PLAYERS.length });
});

app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    rules: DEFAULT_RULES,
    priceTiers: [
      { label: '₹30 Lakhs', value: 3000000 },
      { label: '₹50 Lakhs', value: 5000000 },
      { label: '₹75 Lakhs', value: 7500000 },
      { label: '₹1 Crore', value: 10000000 },
      { label: '₹1.5 Crore', value: 15000000 },
      { label: '₹2 Crore', value: 20000000 },
    ],
    categories: ['Marquee', 'Batter', 'All-Rounder', 'Bowler', 'Wicketkeeper']
  });
});

app.post('/api/export-results', (req: Request, res: Response) => {
  try {
    const { players, teams } = req.body;
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ error: 'Invalid players payload' });
    }

    const headers = [
      'Player ID',
      'Player Name',
      'Category',
      'Role',
      'Nationality',
      'Overseas',
      'Base Price (INR)',
      'Auction Status',
      'Sold Price (INR)',
      'Sold To Team',
      'Team Full Name',
      'Team Owner (Multiplayer)'
    ];

    const teamMap = new Map();
    if (teams && Array.isArray(teams)) {
      teams.forEach((t: { id: string; name: string; ownerName?: string }) => teamMap.set(t.id, t));
    }

    const rows = players.map((p: any) => {
      const t = teamMap.get(p.soldTo);
      return [
        `"${p.id || ''}"`,
        `"${p.name || ''}"`,
        `"${p.category || ''}"`,
        `"${p.role || ''}"`,
        `"${p.nationality || ''}"`,
        p.isOverseas ? 'Yes' : 'No',
        p.basePrice || 0,
        p.status || 'upcoming',
        p.soldPrice || '',
        `"${p.soldTo || ''}"`,
        `"${t?.name || ''}"`,
        `"${t?.ownerName || 'Computer/Solo'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="IPL_2027_Auction_Results.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// Fallback for SPA routing in production
app.use((_req: Request, res: Response) => {
  const indexPath = path.resolve(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Endpoint not found and frontend build not detected' });
  }
});

const portNumber = parseInt(String(PORT), 10) || 3001;
server.listen(portNumber, '0.0.0.0', () => {
  console.log(`[IPL 2027 Simulator API + Socket.IO] Running on port ${portNumber}`);
});
