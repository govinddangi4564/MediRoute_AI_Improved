import { Router } from 'express';
import { z } from 'zod';
import { analyzeReportsWithGemini, analyzeWithGemini } from '../services/gemini.js';
import { recommendHospitals } from '../services/maps.js';
import { Patient } from '../models/patient.js';
import { io } from '../server.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/analyze/symptoms', async (req, res) => {
  const schema = z.object({ text: z.string().min(4), language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid symptom payload' });

  try {
    const result = await analyzeWithGemini(parsed.data.text, parsed.data.language);
    
    // Save to DB
    const patient = new Patient({
      symptoms: parsed.data.text,
      language: parsed.data.language,
      severity: result.severity,
      emergencyLevel: result.emergencyLevel,
      possibleDisease: result.possibleDisease,
      department: result.department,
      status: 'pending'
    });
    await patient.save();
    
    // Emit real-time event to hospital dashboard
    io.emit('new_emergency', patient);
    
    return res.json({ ...result, patientId: patient._id });
  } catch (err) {
    console.error(err);
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

// Dashboard endpoints
router.get('/dashboard/patients', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 }).limit(50);
    return res.json(patients);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

export default router;
