import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['bind'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date },
}, { timestamps: true });

PhoneVerificationSchema.index({ phone: 1, purpose: 1, createdAt: -1 });

export default mongoose.models.PhoneVerification || mongoose.model('PhoneVerification', PhoneVerificationSchema);
