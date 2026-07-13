import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Task from '@/models/Task';

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();

    const body = await request.json();
    
    // We expect the frontend to pass the final streamed text and any aioncore artifact info
    const updatePayload = {
      status: 'completed',
      'runtime.state': 'completed',
      'runtime.updatedAt': new Date()
    };

    if (body.text) {
      updatePayload.aiTextResponse = body.text;
      updatePayload['runtime.streamedText'] = body.text;
    }

    if (body.cost !== undefined) {
      updatePayload.cost = body.cost;
    }

    const result = await Task.updateOne(
      { _id: id, userId: user._id },
      { $set: updatePayload }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: '任务不存在或无权访问' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to finish task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
