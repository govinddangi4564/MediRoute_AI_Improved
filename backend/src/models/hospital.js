import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema(
  {
    sourceKey: { type: String, unique: true, sparse: true },
    source: { type: String, enum: ['osm', 'google', 'manual'], default: 'osm' },
    sourceId: { type: String, default: '' },
    name: { type: String, required: true },
    normalizedName: { type: String, default: '' },
    rating: { type: Number, default: 4.0 },
    address: { type: String, default: 'Address unavailable' },
    phone: { type: String, default: '' },
    types: { type: [String], default: [] },
    qualityVersion: { type: Number, default: 1 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ normalizedName: 1 });

export default mongoose.models.Hospital || mongoose.model('Hospital', hospitalSchema);
