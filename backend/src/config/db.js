import mongoose from 'mongoose';
import Hospital from '../models/hospital.js';

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;

  try {
    await mongoose.connect(uri);
    await Hospital.init();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
}
