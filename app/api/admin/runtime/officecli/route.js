import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { getOfficecliRuntimeStatus, startOfficecliRuntimeUpdate } from '@/lib/office/runtime-status';

export const runtime = 'nodejs';

async function authorize() {
  const admin = await getCurrentAdmin();
  return Boolean(admin && admin.role === 'admin');
}

export async function GET() {
  if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    return NextResponse.json({ success: true, runtime: await getOfficecliRuntimeStatus() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const result = startOfficecliRuntimeUpdate({ force: true });
    if (!result.started) return NextResponse.json({ success: true, alreadyRunning: true });
    return NextResponse.json({ success: true, started: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
