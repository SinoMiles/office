import mongoose from 'mongoose';

const BillingRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['charge', 'consume'], required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
}, { timestamps: true });

export default mongoose.models.BillingRecord || mongoose.model('BillingRecord', BillingRecordSchema);
