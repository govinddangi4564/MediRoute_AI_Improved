import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { analyzeReportsWithGemini, analyzeWithGemini } from '../services/gemini.js';
import { recommendHospitals } from '../services/maps.js';
import { Patient } from '../models/patient.js';
import { HospitalUser } from '../models/hospitalUser.js';
import { AmbulanceDriver } from '../models/ambulanceDriver.js';
import { io } from '../server.js';
import { authenticateToken } from '../middleware/auth.js';
import { startEmergencyRouting } from '../services/routing.js';
import { mockEmergencyCall } from '../services/twilio.js';

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

    return res.json(result);
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
        { status: 'assigned', assignedTo: req.user.id }
      ]
    }).populate('requestedHospital', 'hospitalName').sort({ createdAt: -1 }).limit(50);
    return res.json(patients);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

// Fetch historical admitted (resolved) patients for a hospital
router.get('/dashboard/history', authenticateToken, async (req, res) => {
  try {
    const patients = await Patient.find({
      assignedTo: req.user.id,
      status: 'resolved'
    })
    .populate('requestedHospital', 'hospitalName')
    .populate('assignedAmbulance', 'driverName vehicleNumber')
    .sort({ createdAt: -1 });

    return res.json(patients);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch patient history' });
  }
});

// Explicit request for medical help from a selected hospital
router.post('/emergency/:id/request', async (req, res) => {
  try {
    const schema = z.object({
      hospitalId: z.string().min(1),
      hospitalName: z.string().min(2),
      hospitalPhone: z.string().optional()
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
      // Option 1: Trigger Automated Twilio Call to Unregistered Hospital
      mockEmergencyCall(parsed.data.hospitalName, parsed.data.hospitalPhone, { symptoms: patient.symptoms });
      
      // Option 2: Broadcast to Independent Ambulance Drivers (Uber Model)
      io.to('driver_independent').emit('independent_mission_broadcast', populatedPatient);
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
    await Patient.updateOne({ _id: patient._id }, { $set: { status: 'assigned', assignedTo: req.user.id } });

    // Notify all clients to remove this emergency from their feed (or update status)
    io.emit('emergency_accepted', { patientId: patient._id, hospitalId: req.user.id });
    io.to(`patient_${patient._id}`).emit('ambulance_dispatched');

    return res.json({ message: 'Emergency claimed successfully', patient });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to claim emergency' });
  }
});

// Assign driver endpoint
router.post('/emergency/:id/assign-driver', authenticateToken, async (req, res) => {
  try {
    const schema = z.object({ driverId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Driver ID is required' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Emergency not found' });
    if (patient.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Emergency not assigned to your hospital' });
    }

    const driver = await AmbulanceDriver.findById(parsed.data.driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (!driver.isAvailable) return res.status(400).json({ message: 'Driver is already on a mission' });

    driver.isAvailable = false;
    await driver.save();

    patient.assignedAmbulance = parsed.data.driverId;
    await Patient.updateOne({ _id: patient._id }, { $set: { assignedAmbulance: parsed.data.driverId } });

    // Populate patient completely for the driver
    const populatedPatient = await Patient.findById(patient._id).populate('requestedHospital', 'hospitalName');
    
    // Notify the specific driver
    io.to(`driver_${parsed.data.driverId}`).emit('new_mission', populatedPatient);

    return res.json({ message: 'Driver assigned successfully', patient });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to assign driver' });
  }
});

// Mark emergency as admitted (resolved)
router.post('/emergency/:id/admit', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Emergency not found' });
    if (patient.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Emergency not assigned to your hospital' });
    }

    patient.status = 'resolved';
    await Patient.updateOne({ _id: patient._id }, { $set: { status: 'resolved' } });

    return res.json({ message: 'Patient marked as admitted successfully', patient });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to mark patient as admitted' });
  }
});

// Independent Driver Claim Endpoint
router.post('/emergency/:id/driver-claim', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Emergency not found' });
    if (patient.status !== 'pending') return res.status(400).json({ message: 'Emergency already claimed' });

    const driver = await AmbulanceDriver.findById(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (!driver.isAvailable) return res.status(400).json({ message: 'You are already on a mission' });

    driver.isAvailable = false;
    await driver.save();

    patient.status = 'assigned';
    patient.assignedAmbulance = req.user.id;
    await Patient.updateOne({ _id: patient._id }, { $set: { status: 'assigned', assignedAmbulance: req.user.id } });

    // Populate patient completely for the driver
    const populatedPatient = await Patient.findById(patient._id).populate('requestedHospital', 'hospitalName');

    // Notify the driver that they successfully claimed it
    io.to(`driver_${req.user.id}`).emit('new_mission', populatedPatient);
    
    // Notify all independent drivers to remove it from their boards
    io.emit('independent_mission_claimed', { patientId: patient._id });

    // Notify the patient
    io.to(`patient_${patient._id}`).emit('ambulance_dispatched');

    return res.json({ message: 'Mission claimed successfully', patient });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to claim independent mission' });
  }
});

export default router;
