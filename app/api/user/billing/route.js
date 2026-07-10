import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import BillingRecord from '@/models/BillingRecord';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const records = await BillingRecord.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50);
    
    return NextResponse.json({ success: true, records, balance: user.balance });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
