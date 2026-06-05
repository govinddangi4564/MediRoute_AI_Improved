import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ambulanceDriverSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  driverName: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalUser' },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

ambulanceDriverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

ambulanceDriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const AmbulanceDriver = mongoose.model('AmbulanceDriver', ambulanceDriverSchema);
