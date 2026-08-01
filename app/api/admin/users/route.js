import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { normalizePhone } from '@/lib/phone';
import { randomBytes } from 'node:crypto';

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();
    const users = await User.find({ role: 'user' }).select('-password -email').sort({ createdAt: -1 });
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function POST(req) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { phone: rawPhone, password, membershipLevel, balance } = await req.json();
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }
    if (membershipLevel && !['FREE', 'PRO'].includes(membershipLevel)) {
      return NextResponse.json({ error: '会员等级只支持 FREE 或 PRO' }, { status: 400 });
    }

    await connectToDatabase();
    
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return NextResponse.json({ error: '该手机号已被注册' }, { status: 400 });
    }

    const newUser = new User({
      email: `phone-${phone}@account.officegpt.invalid`,
      phone,
      phoneVerifiedAt: new Date(),
      phoneSignupAt: new Date(),
      password: password || randomBytes(24).toString('base64url'),
      ...(password ? { phonePasswordEnabledAt: new Date() } : {}),
      role: 'user',
      membershipLevel: membershipLevel || 'FREE',
      balance: balance || 0
    });

    await newUser.save();
    return NextResponse.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
