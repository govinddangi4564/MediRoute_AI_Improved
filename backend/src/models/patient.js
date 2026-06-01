import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  symptoms: { type: String, required: true },
  language: { type: String, default: 'en' },
  severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'], required: true },
  emergencyLevel: { type: String },
  possibleDisease: { type: String },
  department: { type: String },
  status: { type: String, enum: ['pending', 'assigned', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const Patient = mongoose.model('Patient', patientSchema);
