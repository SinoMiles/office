import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import Task from '@/models/Task';

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    await connectToDatabase();
    
    // Only allow user to update their own tasks
    const task = await Task.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { prompt: body.prompt } },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
