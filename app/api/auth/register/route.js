import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    await connectToDatabase();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: '请提供邮箱和密码' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 400 });
    }

    const user = await User.create({
      email,
      password: password,
      balance: 10000, // 默认赠送 10000 Tokens
      role: 'user'
    });

    const token = signToken({ id: user._id, role: user.role });
    
    const response = NextResponse.json({ success: true, user: { email: user.email, role: user.role, balance: user.balance } });
    
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: '注册失败: ' + error.message }, { status: 500 });
  }
}
