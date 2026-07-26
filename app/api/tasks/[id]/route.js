import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectToDatabase();
  const { id } = await params;
  const task = await Task.findOne({ _id: id, userId: user._id }).lean();
  if (!task) return NextResponse.json({ error: 'Task not found or permission denied' }, { status: 404 });
  return NextResponse.json({ success: true, task });
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.prompt === undefined && body.isPinned === undefined) {
      return NextResponse.json({ error: 'Update payload is empty' }, { status: 400 });
    }

    await connectToDatabase();
    
    const updateData = {};
    if (body.prompt !== undefined) updateData.prompt = body.prompt;
    if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;
    
    // Only allow user to update their own tasks
    const task = await Task.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: updateData },
      { new: true }
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found or permission denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await connectToDatabase();
    
    // Only allow user to delete their own tasks
    const task = await Task.findOneAndDelete({ _id: id, userId: user._id });

    if (!task) {
      return NextResponse.json({ error: 'Task not found or permission denied' }, { status: 404 });
    }

    // 侧边栏一行代表一个会话，而追问会在同一个 aionConversationId 下继续新建
    // Task。只删根 Task 的话，剩下的轮次会被重新聚合成一行「删不掉」的记录，
    // 所以整个会话一并清掉。
    let removed = 1;
    if (task.aionConversationId) {
      const rest = await Task.deleteMany({ userId: user._id, aionConversationId: task.aionConversationId });
      removed += rest.deletedCount || 0;
    }

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
