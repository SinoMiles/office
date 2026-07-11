import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { cancelTaskRuntime } from '@/lib/task-runtime';
import Task from '@/models/Task';

export async function POST(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOneAndUpdate(
    { _id: id, userId: user._id, status: { $in: ['processing', 'cancelling'] } },
    { $set: { status: 'cancelling', 'runtime.state': 'cancelling', 'runtime.cancelRequested': true, 'runtime.updatedAt': new Date() } },
    { new: true },
  );
  if (!task) return NextResponse.json({ error: '任务不存在或已结束' }, { status: 404 });
  cancelTaskRuntime(id);
  return NextResponse.json({ success: true, task });
}
