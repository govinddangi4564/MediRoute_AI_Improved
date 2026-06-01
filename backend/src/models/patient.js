import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  symptoms: { type: String, required: true },
  language: { type: String, default: 'en' },
  severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'], required: true },
  emergencyLevel: { type: String },
  possibleDisease: { type: String },
  department: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  status: { type: String, enum: ['pending', 'assigned', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

patientSchema.index({ location: '2dsphere' });

export const Patient = mongoose.model('Patient', patientSchema);
