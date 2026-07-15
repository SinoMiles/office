import mongoose from 'mongoose';

const RechargeCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  codeHint: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['active', 'redeemed', 'disabled'], default: 'active', index: true },
  expiresAt: { type: Date, required: true },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  redeemedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.models.RechargeCode || mongoose.model('RechargeCode', RechargeCodeSchema);
