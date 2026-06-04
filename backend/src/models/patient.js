import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  symptoms: { type: String, required: true },
  language: { type: String, default: 'en' },
  severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'], required: true },
  emergencyLevel: { type: String },
  possibleDisease: { type: String },
  department: { type: String },
  confidenceScore: { type: Number, default: 0 },
  profile: {
    age: { type: Number },
    gender: { type: String, default: '' },
    conditions: { type: String, default: '' },
    allergies: { type: String, default: '' },
    medications: { type: String, default: '' },
    pregnancyStatus: { type: String, default: '' },
    emergencyContact: { type: String, default: '' }
  },
  followUpQuestions: { type: [String], default: [] },
  riskTimeline: { type: [String], default: [] },
  escalationTriggers: { type: [String], default: [] },
  handoffSummary: { type: String, default: '' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  assignedAmbulance: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbulanceDriver' },
  requestedHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  requestedHospitalName: { type: String, default: '' },
  requestedHospitalExternalId: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'pending', 'assigned', 'resolved'], default: 'draft' },
  createdAt: { type: Date, default: Date.now }
});

patientSchema.index({ location: '2dsphere' });

export const Patient = mongoose.model('Patient', patientSchema);
