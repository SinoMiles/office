import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const turns = [];
  let current = await Task.findOne({ _id: id, userId: user._id }).lean();
  while (current && turns.length < 50) {
    turns.unshift(current);
    current = current.parentTaskId
      ? await Task.findOne({ _id: current.parentTaskId, userId: user._id }).lean()
      : null;
  }
  if (!turns.length) return NextResponse.json({ error: 'Task not found or permission denied' }, { status: 404 });
  return NextResponse.json({ success: true, tasks: turns });
}
