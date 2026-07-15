import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hashRechargeCode } from '@/lib/billing/recharge-code';
import BillingRecord from '@/models/BillingRecord';
import RechargeCode from '@/models/RechargeCode';
import User from '@/models/User';

export async function POST(request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: '请输入充值码' }, { status: 400 });
  await connectToDatabase();
  const redeemedAt = new Date();
  const recharge = await RechargeCode.findOneAndUpdate(
    { codeHash: hashRechargeCode(code), status: 'active', expiresAt: { $gt: redeemedAt } },
    { $set: { status: 'redeemed', redeemedBy: currentUser._id, redeemedAt } },
    { new: true },
  );
  if (!recharge) return NextResponse.json({ error: '充值码无效、已使用或已过期' }, { status: 400 });
  let credited = false;
  try {
    const user = await User.findByIdAndUpdate(currentUser._id, { $inc: { balance: recharge.amount } }, { new: true });
    credited = true;
    await BillingRecord.create({
      userId: currentUser._id,
      type: 'charge',
      amount: recharge.amount,
      balanceDelta: recharge.amount,
      balanceBefore: user.balance - recharge.amount,
      balanceAfter: user.balance,
      description: `充值码兑换 · 尾号 ${recharge.codeHint}`,
      idempotencyKey: `recharge-code:${recharge._id}`,
      metadata: { rechargeCodeId: recharge._id },
    });
    return NextResponse.json({ success: true, amount: recharge.amount, balance: user.balance });
  } catch (error) {
    if (credited) await User.updateOne({ _id: currentUser._id }, { $inc: { balance: -recharge.amount } });
    await RechargeCode.updateOne({ _id: recharge._id, redeemedBy: currentUser._id }, { $set: { status: 'active' }, $unset: { redeemedBy: '', redeemedAt: '' } });
    throw error;
  }
}
