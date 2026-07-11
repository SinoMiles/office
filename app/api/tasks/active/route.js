import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const task = await Task.findOne({ userId: user._id, status: { $in: ['processing', 'cancelling'] } }).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ success: true, task: task || null });
}
