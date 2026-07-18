import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';
import { reconcileTaskArtifacts } from '@/lib/workspace/artifact-reconcile';
import { taskArtifactViews } from '@/lib/office/artifacts';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id });
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  try {
    const previous = task.artifacts?.length || 0;
    await reconcileTaskArtifacts(task);
    if ((task.artifacts?.length || 0) !== previous) await task.save();
    return NextResponse.json({ success: true, artifacts: taskArtifactViews(task) });
  } catch (error) {
    return NextResponse.json({ error: error.message || '产物扫描失败' }, { status: 500 });
  }
}
