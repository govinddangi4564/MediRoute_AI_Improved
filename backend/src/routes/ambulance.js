import { Router } from 'express';
import { AmbulanceDriver } from '../models/ambulanceDriver.js';
import { Patient } from '../models/patient.js';
import { authenticateToken } from '../middleware/auth.js';
import { z } from 'zod';
import { io } from '../server.js';

const router = Router();

// Get all drivers for the logged-in hospital
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const drivers = await AmbulanceDriver.find({ hospitalId: req.user.id }).select('-password');
    return res.json(drivers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch drivers' });
  }
});

// Driver fetches their current active mission
router.get('/mission', authenticateToken, async (req, res) => {
  try {
    // A mission is an emergency assigned to this driver that is not yet resolved
    const patient = await Patient.findOne({
      assignedAmbulance: req.user.id,
      status: 'assigned'
    }).populate('requestedHospital', 'hospitalName');
    
    return res.json(patient || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch mission' });
  }
});

export default router;
