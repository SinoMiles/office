import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: String, required: true },
  membershipLevel: { type: String, enum: ['PRO', 'ENTERPRISE'], required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled', 'refunded'], default: 'active', index: true },
  // 手动续费模式下 autoRenew 只表达“用户希望继续订阅”，用于决定是否发送到期提醒。
  // 将来接入微信委托代扣时，renewMethod 切到 papay 并复用同一套周期推进逻辑。
  autoRenew: { type: Boolean, default: true },
  renewMethod: { type: String, enum: ['manual', 'papay'], default: 'manual' },
  contractId: { type: String },
  periodMonths: { type: Number, required: true, min: 1 },
  // periodCount 从 1 开始，每次续费 +1，同时作为发放赠送额度的幂等序号。
  periodCount: { type: Number, default: 1, min: 1 },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true, index: true },
  monthlyCredits: { type: Number, default: 0, min: 0 },
  pricingSnapshot: { type: mongoose.Schema.Types.Mixed },
  lastOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentOrder' },
  // 已入账的订单 id，作为周期推进的幂等护栏：同一笔订单重放不会重复顺延周期。
  appliedOrders: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  // 已发出的到期提醒里程碑（7 / 3 / 1），避免同一周期重复发信。
  remindersSent: { type: [Number], default: [] },
  cancelledAt: { type: Date },
  expiredAt: { type: Date },
}, { timestamps: true });

// 一个用户同一时间只允许有一条 active 订阅，用局部唯一索引兜住并发下单。
SubscriptionSchema.index({ userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export default mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
