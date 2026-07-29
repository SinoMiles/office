import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  emailVerifiedAt: { type: Date },
  // 手机号唯一是整套防薅羊毛的地基：注册赠送额度改为绑定后才发放，
  // 一个号码只能挂在一个账号上，小号成本就从「换个邮箱」变成「换张卡」。
  phone: { type: String, sparse: true, unique: true, index: true },
  phoneVerifiedAt: { type: Date },
  wechatOpenId: { type: String, sparse: true, index: true },
  // 邀请码在首次被查看时惰性生成，不在注册时就占号 —— 大多数账号从不分享。
  inviteCode: { type: String, sparse: true, unique: true, index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  invitedAt: { type: Date },
  // 奖励发放的时点，同时也是「这条邀请已经兑现过」的幂等标记
  referralRewardedAt: { type: Date },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balance: { type: Number, default: 0 },
  billingVersion: { type: Number, default: 1 },
  membershipLevel: { type: String, enum: ['FREE', 'PRO', 'ENTERPRISE'], default: 'FREE' },
  tokenVersion: { type: Number, default: 0 },
  appliedBillingOperations: { type: [String], default: [], select: false },
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

delete mongoose.models.User;
export default mongoose.models.User || mongoose.model('User', UserSchema);
