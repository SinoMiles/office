import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch total files processed
    const totalFiles = await Task.countDocuments({ userId: user._id });

    // Fetch total consumed tokens
    const consumptionResult = await BillingRecord.aggregate([
      { $match: { userId: user._id, type: 'consume' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalConsumed = consumptionResult[0]?.total || 0;

    // Fetch recent task records (files processed) for chat history
    const recentTasks = await Task.find({ userId: user._id })
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50);

    return NextResponse.json({ 
      success: true, 
      user: {
        username: user.username,
        email: user.email,
        role: user.role
      },
      stats: {
        totalFiles,
        totalConsumed: totalConsumed.toFixed(2),
        savedTimeHours: (totalFiles * 0.5).toFixed(1), // Assuming 30 mins saved per file
        recentTasks
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
