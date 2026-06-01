import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDb } from './config/db.js';
import patientRoutes from './routes/patient.js';
import wearableRoutes from './routes/wearable.js';
import voiceRoutes from './routes/voice.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const httpServer = createServer(app);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowedOrigin = allowedOrigins.includes(origin);
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
    const isVercelPreview = process.env.ALLOW_VERCEL_PREVIEWS !== 'false' && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

    if (isAllowedOrigin || isLocalhost || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));

export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_hospital_room', (hospitalId) => {
    console.log(`Hospital ${hospitalId} joined its dedicated room`);
    socket.join(`hospital_${hospitalId}`);
  });

  socket.on('request_ambulance', (data) => {
    console.log('Ambulance requested to:', data);
    const { targetLat, targetLng } = data;
    
    // Simulate ambulance starting 5km away
    let currentLat = targetLat - 0.05;
    let currentLng = targetLng - 0.05;
    
    const interval = setInterval(() => {
      // Move 5% of the remaining distance per tick
      const latDiff = targetLat - currentLat;
      const lngDiff = targetLng - currentLng;
      
      currentLat += latDiff * 0.05;
      currentLng += lngDiff * 0.05;
      
      socket.emit('ambulance_location', { lat: currentLat, lng: currentLng });
      
      // Stop when very close
      if (Math.abs(latDiff) < 0.001 && Math.abs(lngDiff) < 0.001) {
        clearInterval(interval);
        socket.emit('ambulance_arrived');
      }
    }, 2000); // update every 2 seconds
    
    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lifeline-ai-backend' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'lifeline-ai-backend' }));
app.use('/api', patientRoutes);
app.use('/api/wearable', wearableRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/auth', authRoutes);

connectDb();

if (!process.env.VERCEL) {
  httpServer.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

export default app;
