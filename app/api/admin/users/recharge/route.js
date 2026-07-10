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
    
    // Create billing record
    const record = new BillingRecord({
      userId,
      type: amount > 0 ? 'charge' : 'consume',
      amount: Math.abs(amount),
      description: description || 'Admin manual recharge'
    });
    await record.save();

    // Update user balance
    const user = await User.findByIdAndUpdate(
      userId, 
      { $inc: { balance: amount } }, 
      { new: true }
    );

    return NextResponse.json({ success: true, balance: user.balance });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
