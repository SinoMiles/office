import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  wechatOpenId: { type: String, sparse: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balance: { type: Number, default: 0 },
  billingVersion: { type: Number, default: 1 },
  membershipLevel: { type: String, enum: ['FREE', 'PRO', 'ENTERPRISE'], default: 'FREE' },
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

delete mongoose.models.User;
export default mongoose.models.User || mongoose.model('User', UserSchema);
