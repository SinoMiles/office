import mongoose from 'mongoose';

const BillingRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['charge', 'reserve', 'consume', 'refund', 'adjustment'], required: true },
  amount: { type: Number, required: true },
  balanceDelta: { type: Number },
  unit: { type: String, default: 'credits' },
  description: { type: String },
  relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  idempotencyKey: { type: String },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  status: { type: String, enum: ['posted', 'void'], default: 'posted' },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

BillingRecordSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.models.BillingRecord || mongoose.model('BillingRecord', BillingRecordSchema);
