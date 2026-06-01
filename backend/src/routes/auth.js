import { Router } from 'express';
import { z } from 'zod';
import { HospitalUser } from '../models/hospitalUser.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    hospitalName: z.string().min(3),
    address: z.string().min(5),
    lat: z.number().optional(),
    lng: z.number().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid registration payload' });

  try {
    const existingUser = await HospitalUser.findOne({ email: parsed.data.email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const userData = {
      ...parsed.data,
      location: {
        type: 'Point',
        coordinates: [parsed.data.lng || 77.2090, parsed.data.lat || 28.6139] // [longitude, latitude]
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

export default router;
