import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateRechargeCode, hashRechargeCode } from '@/lib/billing/recharge-code';
import RechargeCode from '@/models/RechargeCode';

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  await connectToDatabase();
  const codes = await RechargeCode.find().sort({ createdAt: -1 }).limit(100).select('-codeHash').lean();
  return NextResponse.json({ success: true, codes });
}

export async function POST(request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  const amount = Number(body.amount);
  const validDays = Math.min(3650, Math.max(1, Number(body.validDays) || 365));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Credits 数量必须大于 0' }, { status: 400 });
  await connectToDatabase();
  const code = generateRechargeCode();
  const expiresAt = new Date(Date.now() + validDays * 86_400_000);
  const record = await RechargeCode.create({ codeHash: hashRechargeCode(code), codeHint: code.slice(-8), amount, expiresAt, createdBy: admin._id });
  return NextResponse.json({ success: true, code, record: { id: record._id, amount, expiresAt } });
}
