import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Task from '@/models/Task';
import { reconcileTaskArtifacts } from '@/lib/workspace/artifact-reconcile';
import { taskArtifactViews } from '@/lib/office/artifacts';

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();

    const body = await request.json();
    
    const task = await Task.findOne({ _id: id, userId: user._id });
    if (!task) {
      return NextResponse.json({ error: '任务不存在或无权访问' }, { status: 404 });
    }
    Object.assign(task, { status: 'completed', aiTextResponse: body.text || task.aiTextResponse, cost: body.cost ?? task.cost });
    task.runtime.state = 'completed';
    task.runtime.updatedAt = new Date();
    if (body.text) task.runtime.streamedText = body.text;
    await reconcileTaskArtifacts(task);
    for (const artifact of task.artifacts || []) {
      artifact.status = 'ready';
      artifact.updatedAt = new Date();
    }
    await task.save();

    return NextResponse.json({ success: true, artifacts: taskArtifactViews(task) });
  } catch (error) {
    console.error('Failed to finish task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
