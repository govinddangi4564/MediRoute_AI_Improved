import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectDb } from './config/db.js';
import patientRoutes from './routes/patient.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

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
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lifeline-ai-backend' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'lifeline-ai-backend' }));
app.use('/api', patientRoutes);

connectDb();

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

export default app;
