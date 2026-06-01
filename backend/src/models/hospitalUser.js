import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const hospitalUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  hospitalName: { type: String, required: true },
  address: { type: String, required: true },
  availableBeds: { type: Number, default: 0 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  createdAt: { type: Date, default: Date.now }
});

hospitalUserSchema.index({ location: '2dsphere' });

hospitalUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

hospitalUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const HospitalUser = mongoose.model('HospitalUser', hospitalUserSchema);
