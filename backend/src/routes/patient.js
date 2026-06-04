import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { analyzeReportsWithGemini, analyzeWithGemini } from '../services/gemini.js';
import { recommendHospitals } from '../services/maps.js';
import { Patient } from '../models/patient.js';
import { HospitalUser } from '../models/hospitalUser.js';
import { io } from '../server.js';
import { authenticateToken } from '../middleware/auth.js';
import { startEmergencyRouting } from '../services/routing.js';

const router = Router();

router.post('/analyze/symptoms', async (req, res) => {
  const profileSchema = z.object({
    age: z.coerce.number().int().min(0).max(120).optional(),
    gender: z.string().max(40).optional(),
    conditions: z.string().max(300).optional(),
    allergies: z.string().max(300).optional(),
    medications: z.string().max(300).optional(),
    pregnancyStatus: z.string().max(80).optional(),
    emergencyContact: z.string().max(80).optional()
  }).optional();
  const schema = z.object({
    text: z.string().min(4),
    language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa']),
    profile: profileSchema,
    lat: z.number().optional(),
    lng: z.number().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid symptom payload' });

  try {
    const profile = parsed.data.profile || {};
    const result = await analyzeWithGemini(parsed.data.text, parsed.data.language, profile);

    const defaultLng = 77.2090;
    const defaultLat = 28.6139;
    const lng = typeof parsed.data.lng === 'number' ? parsed.data.lng : defaultLng;
    const lat = typeof parsed.data.lat === 'number' ? parsed.data.lat : defaultLat;

    // Save to DB
    const patient = new Patient({
      symptoms: parsed.data.text,
      language: parsed.data.language,
      severity: result.severity,
      emergencyLevel: result.emergencyLevel,
      possibleDisease: result.possibleDisease,
      department: result.department,
      confidenceScore: result.confidenceScore,
      profile,
      followUpQuestions: result.followUpQuestions || [],
      riskTimeline: result.riskTimeline || [],
      escalationTriggers: result.escalationTriggers || [],
      handoffSummary: result.handoffSummary || '',
      status: 'draft',
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
    await patient.save();

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
    const { lat, lng, department, severity } = parsed.data;
    const result = await recommendHospitals({ lat, lng, department, severity });
    const patient = new Patient({
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      ...result
    });
    await patient.save();

    return res.json({ ...result, patientId: patient._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Symptom analysis failed' });
  }
});


// Dashboard endpoints
router.get('/dashboard/patients', authenticateToken, async (req, res) => {
  try {
    const hospital = await HospitalUser.findById(req.user.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

    const radiusInRadians = 50000 / 6378100; // 50km

    const patients = await Patient.find({
      $or: [
        { status: 'pending', requestedHospital: req.user.id },
        {
          status: 'pending',
          requestedHospital: { $exists: false },
          location: {
            $geoWithin: {
              $centerSphere: [hospital.location.coordinates, radiusInRadians]
            }
          }
        },
        {
          status: 'pending',
          requestedHospital: null,
          location: {
            $geoWithin: {
              $centerSphere: [hospital.location.coordinates, radiusInRadians]
            }
          }
        },
        { assignedTo: req.user.id }
      ]
    }).populate('requestedHospital', 'hospitalName').sort({ createdAt: -1 }).limit(50);
    return res.json(patients);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

// Explicit request for medical help from a selected hospital
router.post('/emergency/:id/request', async (req, res) => {
  try {
    const schema = z.object({
      hospitalId: z.string().min(1),
      hospitalName: z.string().min(2)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Hospital selection is required' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    patient.status = 'pending';
    patient.requestedHospitalName = parsed.data.hospitalName;
    patient.requestedHospitalExternalId = parsed.data.hospitalId;
    if (mongoose.Types.ObjectId.isValid(parsed.data.hospitalId)) {
      patient.requestedHospital = parsed.data.hospitalId;
    }
    await patient.save();

    const populatedPatient = await Patient.findById(patient._id).populate('requestedHospital', 'hospitalName');
    if (mongoose.Types.ObjectId.isValid(parsed.data.hospitalId)) {
      io.to(`hospital_${parsed.data.hospitalId}`).emit('new_emergency', populatedPatient);
    } else {
      startEmergencyRouting(patient._id);
    }

    return res.json({ message: 'Medical help request sent successfully', patient: populatedPatient });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to request medical help' });
  }
});

// Emergency accept endpoint
router.post('/emergency/:id/accept', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Emergency not found' });
    if (patient.status !== 'pending') return res.status(400).json({ message: 'Emergency already claimed' });

    patient.status = 'assigned';
    patient.assignedTo = req.user.id;
    await patient.save();

    // Notify all clients to remove this emergency from their feed (or update status)
    io.emit('emergency_accepted', { patientId: patient._id, hospitalId: req.user.id });
    io.to(`patient_${patient._id}`).emit('ambulance_dispatched');

    return res.json({ message: 'Emergency claimed successfully', patient });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to claim emergency' });
  }
});

export default router;
