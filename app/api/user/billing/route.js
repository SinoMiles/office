import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import BillingRecord from '@/models/BillingRecord';
import SystemSetting from '@/models/SystemSetting';
import { normalizeBillingSettings } from '@/lib/billing/pricing';

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const page = positiveInteger(searchParams.get('page'), 1);
    const pageSize = Math.min(50, Math.max(10, positiveInteger(searchParams.get('pageSize'), 20)));
    const type = searchParams.get('type');
    const query = { userId: user._id, ...(type && type !== 'all' ? { type } : { type: { $in: ['charge', 'consume', 'adjustment'] } }) };
    const [records, total, billingSetting] = await Promise.all([
      BillingRecord.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).populate('relatedTaskId', 'prompt filename').lean(),
      BillingRecord.countDocuments(query),
      SystemSetting.findOne({ key: 'billing' }).lean(),
    ]);
    const pricing = normalizeBillingSettings(billingSetting?.value || {});
    
    return NextResponse.json({ success: true, records, balance: user.balance, unit: 'credits', pricing: { creditsPerCny: pricing.creditsPerCny }, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
