import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export async function PUT(req, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const updateData = await req.json();

    if (!updateData.email) {
      return NextResponse.json({ error: '邮箱是必填项' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: '未找到该用户' }, { status: 404 });
    }

    // Check email uniqueness if changing email
    if (user.email !== updateData.email) {
      const existing = await User.findOne({ email: updateData.email });
      if (existing) {
        return NextResponse.json({ error: '该邮箱已被其他账号使用' }, { status: 400 });
      }
    }

    user.email = updateData.email;
    if (updateData.role) user.role = updateData.role;
    if (updateData.membershipLevel) user.membershipLevel = updateData.membershipLevel;
    if (updateData.balance !== undefined) user.balance = updateData.balance;
    if (updateData.password) {
      user.password = updateData.password; // pre-save hook handles hashing
    }

    await user.save();

    return NextResponse.json({ success: true, message: '用户信息已更新' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();
    
    // As per the plan, we only delete the user record, keeping billing and task logs for audit.
    const result = await User.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '用户已成功删除' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
