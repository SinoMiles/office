import mongoose from 'mongoose';

const RefundRecordSchema = new mongoose.Schema({
  outRefundNo: { type: String, required: true, unique: true, index: true },
  paymentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentOrder', required: true, index: true },
  outTradeNo: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // 退款金额（分）与订单原始金额（分），微信要求两者一起提交。
  refundFen: { type: Number, required: true, min: 1 },
  totalFen: { type: Number, required: true, min: 1 },
  // 按退款金额占比扣回的 credits，可能因用户已消费而把余额扣成负数。
  clawbackCredits: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'processing', 'success', 'closed', 'abnormal'], default: 'pending', index: true },
  reason: { type: String },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  providerRefundId: { type: String },
  succeededAt: { type: Date },
  errorMessage: { type: String },
}, { timestamps: true });

export default mongoose.models.RefundRecord || mongoose.model('RefundRecord', RefundRecordSchema);
