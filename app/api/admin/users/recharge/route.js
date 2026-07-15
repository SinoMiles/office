import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import BillingRecord from '@/models/BillingRecord';

export async function POST(req) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, amount, description } = await req.json();
    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await connectToDatabase();
    
    const numericAmount = Number(amount);
    const user = await User.findOneAndUpdate(
      { _id: userId, ...(numericAmount < 0 ? { balance: { $gte: Math.abs(numericAmount) } } : {}) },
      { $inc: { balance: numericAmount } },
      { new: true }
    );
    if (!user) return NextResponse.json({ error: '用户不存在或可用余额不足' }, { status: 400 });
    await BillingRecord.create({
      userId,
      type: numericAmount > 0 ? 'charge' : 'adjustment',
      amount: Math.abs(numericAmount),
      balanceDelta: numericAmount,
      description: description || '后台人工余额调整',
      balanceBefore: user.balance - numericAmount,
      balanceAfter: user.balance,
      metadata: { operatorId: String(admin._id) },
    });

    return NextResponse.json({ success: true, balance: user.balance });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
