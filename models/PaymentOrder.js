import mongoose from 'mongoose';

const PaymentOrderSchema = new mongoose.Schema({
  outTradeNo: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['wechat_native'], default: 'wechat_native' },
  amountFen: { type: Number, required: true, min: 1 },
  credits: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['created', 'paying', 'crediting', 'paid', 'closed', 'failed'], default: 'created', index: true },
  codeUrl: { type: String },
  providerTransactionId: { type: String },
  expiresAt: { type: Date, required: true },
  paidAt: { type: Date },
  lastQueriedAt: { type: Date },
  errorMessage: { type: String },
}, { timestamps: true });

export default mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', PaymentOrderSchema);
