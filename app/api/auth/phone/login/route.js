import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { SESSION_MAX_AGE_SECONDS, signToken } from '@/lib/auth';
import { consumePhoneCode, consumeRateLimit, normalizePhone, requestIp } from '@/lib/auth-security';
import { grantReferralRewards } from '@/lib/referral-service';
import { normalizeInviteCode } from '@/lib/referral';
import BillingRecord from '@/models/BillingRecord';
import User from '@/models/User';

export const runtime = 'nodejs';

const SIGNUP_BONUS_CREDITS = 10000;

async function grantSignupBonus(user) {
  const key = `signup:phone:${user.phone}`;
  const existing = await BillingRecord.findOne({ idempotencyKey: key }).select('_id').lean();
  if (existing) return user;

  const funded = await User.findByIdAndUpdate(
    user._id,
    { $inc: { balance: SIGNUP_BONUS_CREDITS } },
    { new: true },
  );
  try {
    await BillingRecord.create({
      userId: user._id,
      type: 'charge',
      amount: SIGNUP_BONUS_CREDITS,
      balanceDelta: SIGNUP_BONUS_CREDITS,
      balanceBefore: funded.balance - SIGNUP_BONUS_CREDITS,
      balanceAfter: funded.balance,
      description: '新用户注册赠送',
      idempotencyKey: key,
    });
    return funded;
  } catch (error) {
    await User.findByIdAndUpdate(user._id, { $inc: { balance: -SIGNUP_BONUS_CREDITS } });
    if (error?.code !== 11000) throw error;
    return User.findById(user._id);
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '');
    if (!phone || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '请输入有效手机号和短信验证码' }, { status: 400 });
    }

    const [ipRate, phoneRate] = await Promise.all([
      consumeRateLimit({ scope: 'phone-login-ip', identifier: requestIp(request), limit: 30, windowMs: 15 * 60_000 }),
      consumeRateLimit({ scope: 'phone-login-account', identifier: phone, limit: 10, windowMs: 15 * 60_000 }),
    ]);
    if (!ipRate.allowed || !phoneRate.allowed) {
      return NextResponse.json({ error: '尝试次数过多，请稍后再试' }, { status: 429 });
    }
    if (!await consumePhoneCode({ phone, purpose: 'login', code })) {
      return NextResponse.json({ error: '短信验证码错误或已过期' }, { status: 400 });
    }

    let user = await User.findOne({ phone });
    let created = false;
    if (!user) {
      const inviteCode = normalizeInviteCode(body.inviteCode);
      const inviter = inviteCode ? await User.findOne({ inviteCode }).select('_id').lean() : null;
      try {
        user = await User.create({
          // 旧数据结构仍要求邮箱和密码；手机账号使用不可登录的内部占位值，
          // 对用户界面和对外接口均不展示。
          email: `phone-${phone}@account.officegpt.invalid`,
          password: crypto.randomBytes(32).toString('hex'),
          phone,
          phoneVerifiedAt: new Date(),
          phoneSignupAt: new Date(),
          balance: 0,
          role: 'user',
          ...(inviter ? { invitedBy: inviter._id, invitedAt: new Date() } : {}),
        });
        created = true;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        user = await User.findOne({ phone });
      }
    }
    if (!user) throw new Error('手机号账号创建失败');

    // phoneSignupAt 只存在于新的手机号注册账号。每次验证码登录都做一次
    // 幂等补偿，即使服务器恰好在“建号”和“赠送积分”之间重启也不会漏发。
    if (user.phoneSignupAt) {
      user = await grantSignupBonus(user);
      try {
        const referral = await grantReferralRewards(user._id);
        if (referral.granted) user = await User.findById(user._id);
      } catch (error) {
        console.error('[referral] 手机号注册奖励发放失败', error);
      }
    }

    const token = signToken({ id: user._id, role: user.role, version: user.tokenVersion });
    const response = NextResponse.json({
      success: true,
      created,
      user: {
        phone: user.phone,
        role: user.role,
        balance: user.balance,
        membershipLevel: user.membershipLevel || 'FREE',
      },
    });
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[auth:phone] 登录失败', error);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
