import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDb } from './config/db.js';
import { Patient } from './models/patient.js';
import { AmbulanceDriver } from './models/ambulanceDriver.js';
import patientRoutes from './routes/patient.js';
import wearableRoutes from './routes/wearable.js';
import voiceRoutes from './routes/voice.js';
import authRoutes from './routes/auth.js';
import ambulanceRoutes from './routes/ambulance.js';

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

  socket.on('join_patient_room', (patientId) => {
    console.log(`Patient ${patientId} joined tracking room`);
    socket.join(`patient_${patientId}`);
  });

  socket.on('join_driver_room', (driverId, isIndependent) => {
    console.log(`Driver ${driverId} joined driver room. Independent: ${isIndependent}`);
    socket.join(`driver_${driverId}`);
    if (isIndependent) {
      socket.join('driver_independent');
    }
  });

  // From ambulance driver app
  socket.on('update_ambulance_location', (data) => {
    const { patientId, lat, lng } = data;
    io.to(`patient_${patientId}`).emit('ambulance_location', { lat, lng });
  });

  // From ambulance driver app
  socket.on('ambulance_arrived', async (patientId) => {
    io.to(`patient_${patientId}`).emit('ambulance_arrived');
    
    // Free the driver
    try {
      const patient = await Patient.findById(patientId);
      if (patient && patient.assignedAmbulance) {
        await AmbulanceDriver.findByIdAndUpdate(patient.assignedAmbulance, { isAvailable: true });
        // Optional: you could mark the patient as 'resolved' or 'arrived' here
      }
    } catch (err) {
      console.error('Error freeing driver:', err);
    }
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
app.use('/api/ambulance', ambulanceRoutes);

connectDb();

if (!process.env.VERCEL) {
  httpServer.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

export default app;
