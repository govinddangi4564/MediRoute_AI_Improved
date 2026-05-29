import { Router } from 'express';
import { z } from 'zod';
import { analyzeReportsWithGemini, analyzeWithGemini } from '../services/gemini.js';
import { recommendHospitals } from '../services/maps.js';

const router = Router();

router.post('/analyze/symptoms', async (req, res) => {
  const schema = z.object({ text: z.string().min(4), language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid symptom payload' });

  try {
    const result = await analyzeWithGemini(parsed.data.text, parsed.data.language);
    return res.json(result);
  } catch {
    return res.status(500).json({ message: 'Symptom analysis failed' });
  }
});

router.post('/analyze/reports', async (req, res) => {
  const schema = z.object({
    files: z.array(z.object({ name: z.string(), type: z.string(), base64: z.string() })).min(1),
    language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa']).optional(),
    symptomContext: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid report payload' });

  try {
    const result = await analyzeReportsWithGemini(parsed.data.files, parsed.data.language || 'en');
    return res.json(result);
  } catch {
    return res.status(500).json({ message: 'Report analysis failed' });
  }
});

router.post('/hospitals/recommend', async (req, res) => {
  const schema = z.object({
    lat: z.number(),
    lng: z.number(),
    department: z.string().min(3),
    severity: z.enum(['low', 'moderate', 'high', 'critical'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid hospital payload' });

  try {
    const result = await recommendHospitals(parsed.data);
    return res.json(result);
  } catch {
    return res.status(500).json({ message: 'Hospital recommendation failed' });
  }
});

export default router;
