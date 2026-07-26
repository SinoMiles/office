import mongoose from 'mongoose';

const AuthRateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.models.AuthRateLimit || mongoose.model('AuthRateLimit', AuthRateLimitSchema);
