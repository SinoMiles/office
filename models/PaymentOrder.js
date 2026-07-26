import mongoose from 'mongoose';

const PaymentOrderSchema = new mongoose.Schema({
  outTradeNo: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['wechat_native'], default: 'wechat_native' },
  // recharge = 纯充值 credits；subscription = 购买/续订会员套餐。
  purpose: { type: String, enum: ['recharge', 'subscription'], default: 'recharge', index: true },
  planId: { type: String },
  periodMonths: { type: Number, min: 1 },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', index: true },
  amountFen: { type: Number, required: true, min: 1 },
  credits: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['created', 'paying', 'crediting', 'paid', 'closed', 'failed', 'refunding', 'partial_refunded', 'refunded'], default: 'created', index: true },
  codeUrl: { type: String },
  providerTransactionId: { type: String },
  expiresAt: { type: Date, required: true },
  paidAt: { type: Date },
  lastQueriedAt: { type: Date },
  refundedFen: { type: Number, default: 0, min: 0 },
  errorMessage: { type: String },
}, { timestamps: true });

// 管理端订单列表默认按创建时间倒序翻页，并常按状态/用途过滤。
PaymentOrderSchema.index({ createdAt: -1 });

export default mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', PaymentOrderSchema);
