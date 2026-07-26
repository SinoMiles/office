import mongoose from 'mongoose';

const EmailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['register', 'reset-password'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date },
}, { timestamps: true });

EmailVerificationSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export default mongoose.models.EmailVerification || mongoose.model('EmailVerification', EmailVerificationSchema);
