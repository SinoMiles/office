import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function POST(req) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email, password, role, membershipLevel, balance } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码是必填项' }, { status: 400 });
    }
    if (membershipLevel && !['FREE', 'PRO'].includes(membershipLevel)) {
      return NextResponse.json({ error: '会员等级只支持 FREE 或 PRO' }, { status: 400 });
    }

    await connectToDatabase();
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 });
    }

    const newUser = new User({
      email,
      password, // User.pre('save') will hash this
      role: role || 'user',
      membershipLevel: membershipLevel || 'FREE',
      balance: balance || 0
    });

    await newUser.save();
    return NextResponse.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
