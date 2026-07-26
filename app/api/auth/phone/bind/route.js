import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { consumePhoneCode, consumeRateLimit, normalizePhone, requestIp } from '@/lib/auth-security';
import BillingRecord from '@/models/BillingRecord';
import User from '@/models/User';

export const runtime = 'nodejs';

// 注册赠送额度挪到这里发放。注册那一步只要一个邮箱，成本近乎为零；
// 放到绑定手机号之后，薅羊毛就得为每个小号准备一张真实的手机卡。
export const SIGNUP_BONUS_CREDITS = 10000;

export async function POST(request) {
  await connectToDatabase();
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (current.phoneVerifiedAt) return NextResponse.json({ error: '账号已绑定手机号' }, { status: 409 });

  const { phone, code } = await request.json();
  const normalized = normalizePhone(phone);
  if (!normalized) return NextResponse.json({ error: '请输入有效的中国大陆手机号' }, { status: 400 });

  const rate = await consumeRateLimit({ scope: 'phone-bind', identifier: requestIp(request), limit: 20, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
  if (!await consumePhoneCode({ phone: normalized, purpose: 'bind', code: String(code || '') })) {
    return NextResponse.json({ error: '短信验证码错误或已过期' }, { status: 400 });
  }

  // 唯一索引是最后一道闸：并发绑定同一个号码时，先到的成功，
  // 后到的在这里拿到 E11000 而不是悄悄绑上第二个账号。
  let user;
  try {
    user = await User.findOneAndUpdate(
      { _id: current._id, phoneVerifiedAt: null },
      { $set: { phone: normalized, phoneVerifiedAt: new Date() } },
      { new: true },
    );
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: '该手机号已被其他账号绑定' }, { status: 409 });
    throw error;
  }
  if (!user) return NextResponse.json({ error: '账号已绑定手机号' }, { status: 409 });

  // 幂等键按号码而不是按用户：即使将来开放换绑，同一个号码也只能领一次。
  const bonusKey = `signup:phone:${normalized}`;
  const claimed = await BillingRecord.findOne({ idempotencyKey: bonusKey }).select('_id').lean();
  let granted = 0;
  if (!claimed) {
    const funded = await User.findByIdAndUpdate(user._id, { $inc: { balance: SIGNUP_BONUS_CREDITS } }, { new: true });
    try {
      await BillingRecord.create({
        userId: user._id,
        type: 'charge',
        amount: SIGNUP_BONUS_CREDITS,
        balanceDelta: SIGNUP_BONUS_CREDITS,
        balanceBefore: funded.balance - SIGNUP_BONUS_CREDITS,
        balanceAfter: funded.balance,
        description: '绑定手机号赠送',
        idempotencyKey: bonusKey,
      });
      granted = SIGNUP_BONUS_CREDITS;
      user = funded;
    } catch (error) {
      // 流水没落上就把余额退回去，否则账面对不上。唯一键冲突说明
      // 同一号码已经领过，属于正常竞态，不算失败。
      await User.findByIdAndUpdate(user._id, { $inc: { balance: -SIGNUP_BONUS_CREDITS } });
      if (error?.code !== 11000) throw error;
    }
  }

  return NextResponse.json({
    success: true,
    granted,
    user: { phone: user.phone, phoneVerified: true, balance: user.balance },
  });
}
