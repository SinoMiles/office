import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { consumeEmailCode, consumeRateLimit, normalizeEmail, requestIp } from '@/lib/auth-security';
import { normalizeInviteCode } from '@/lib/referral';

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const code = String(body.code || '');

    const rate = await consumeRateLimit({ scope: 'register', identifier: requestIp(req), limit: 5, windowMs: 24 * 60 * 60_000 });
    if (!rate.allowed) return NextResponse.json({ error: '该网络今日注册次数已达上限' }, { status: 429 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: '请输入有效邮箱，密码至少 8 位' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 400 });
    }
    if (!await consumeEmailCode({ email, purpose: 'register', code })) {
      return NextResponse.json({ error: '邮箱验证码错误或已过期' }, { status: 400 });
    }
    // 赠送额度不在这里发了 —— 注册只要一个邮箱，成本近乎为零，按 IP 限流
    // 也挡不住换网络的小号。改到 /api/auth/phone/bind，绑定手机号后才发放，
    // 幂等键按号码走，一个号码只能领一次。
    // 邀请关系在这里落库，奖励要等被邀请人绑定手机号才结算 ——
    // 注册只要一个邮箱，把奖励放在这一步等于重新打开薅羊毛的口子。
    const inviteCode = normalizeInviteCode(body.inviteCode);
    const inviter = inviteCode ? await User.findOne({ inviteCode }).select('_id').lean() : null;

    const user = await User.create({
      email,
      password,
      emailVerifiedAt: new Date(),
      balance: 0,
      role: 'user',
      ...(inviter ? { invitedBy: inviter._id, invitedAt: new Date() } : {}),
    });

    const token = signToken({ id: user._id, role: user.role, version: user.tokenVersion });
    
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
    console.error('Registration failed', error);
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }
}
