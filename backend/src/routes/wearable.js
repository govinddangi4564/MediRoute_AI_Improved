import { Router } from 'express';
import { z } from 'zod';
import { Patient } from '../models/patient.js';
import { io } from '../server.js';
import { startEmergencyRouting } from '../services/routing.js';

const router = Router();

router.post('/sos', async (req, res) => {
  const schema = z.object({
    deviceType: z.string(),
    heartRate: z.number(),
    fallDetected: z.boolean(),
    lat: z.number().optional(),
    lng: z.number().optional()
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid wearable payload' });

  try {
    const data = parsed.data;
    
    // Create emergency text based on vitals
    let symptoms = `Automated SOS from ${data.deviceType}. `;
    if (data.fallDetected) symptoms += 'Hard fall detected. ';
    if (data.heartRate > 120 || data.heartRate < 40) symptoms += `Abnormal heart rate: ${data.heartRate} bpm. `;
    
    // Location fallback to Delhi
    const defaultLng = 77.2090;
    const defaultLat = 28.6139;
    const lng = typeof data.lng === 'number' ? data.lng : defaultLng;
    const lat = typeof data.lat === 'number' ? data.lat : defaultLat;
    
    // Save to DB
    const patient = new Patient({
      symptoms,
      language: 'en',
      severity: 'critical',
      emergencyLevel: 'Immediate SOS',
      possibleDisease: data.fallDetected ? 'Trauma / Fall Injury' : 'Cardiac Event',
      department: 'Emergency Medicine',
      status: 'pending',
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
    
    await patient.save();
    
    // Trigger the expanding radius routing system in background
    startEmergencyRouting(patient._id);
    
    return res.json({ message: 'SOS broadcasted to hospitals successfully', patientId: patient._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'SOS processing failed' });
  }
});

export default router;
