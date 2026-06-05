import { Router } from 'express';
import { z } from 'zod';
import { HospitalUser } from '../models/hospitalUser.js';
import { AmbulanceDriver } from '../models/ambulanceDriver.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    hospitalName: z.string().min(3),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid registration payload' });

  try {
    const existingUser = await HospitalUser.findOne({ email: parsed.data.email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const userData = {
      email: parsed.data.email,
      password: parsed.data.password,
      hospitalName: parsed.data.hospitalName,
      address: `Live location captured at ${parsed.data.lat.toFixed(6)}, ${parsed.data.lng.toFixed(6)}`,
      location: {
        type: 'Point',
        coordinates: [parsed.data.lng, parsed.data.lat] // [longitude, latitude]
      }
    };
    const user = new HospitalUser(userData);
    await user.save();

    const token = generateToken(user);
    return res.status(201).json({ token, user: { id: user._id, email: user.email, hospitalName: user.hospitalName } });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid login payload' });

  try {
    const user = await HospitalUser.findOne({ email: parsed.data.email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(parsed.data.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({ token, user: { id: user._id, email: user.email, hospitalName: user.hospitalName } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await HospitalUser.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/beds', authenticateToken, async (req, res) => {
  const schema = z.object({ availableBeds: z.number().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid beds payload' });

  try {
    const user = await HospitalUser.findByIdAndUpdate(
      req.user.id,
      { availableBeds: parsed.data.availableBeds },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/hospitals', async (req, res) => {
  try {
    const hospitals = await HospitalUser.find().select('hospitalName _id');
    return res.json(hospitals);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/ambulance/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    driverName: z.string().min(2),
    vehicleNumber: z.string().min(2),
    hospitalId: z.string().min(1).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid registration payload' });

  try {
    const existingDriver = await AmbulanceDriver.findOne({ email: parsed.data.email });
    if (existingDriver) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    if (parsed.data.hospitalId) {
      const hospital = await HospitalUser.findById(parsed.data.hospitalId);
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    }

    const driver = new AmbulanceDriver({
      email: parsed.data.email,
      password: parsed.data.password,
      driverName: parsed.data.driverName,
      vehicleNumber: parsed.data.vehicleNumber,
      hospitalId: parsed.data.hospitalId
    });
    await driver.save();

    const token = generateToken(driver); 
    return res.status(201).json({ token, user: { id: driver._id, driverName: driver.driverName, role: 'driver', isIndependent: !driver.hospitalId } });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/ambulance/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid login payload' });

  try {
    const driver = await AmbulanceDriver.findOne({ email: parsed.data.email });
    if (!driver) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await driver.comparePassword(parsed.data.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(driver);
    return res.json({ token, user: { id: driver._id, driverName: driver.driverName, role: 'driver', isIndependent: !driver.hospitalId } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
