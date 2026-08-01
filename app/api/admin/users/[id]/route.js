import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { normalizePhone } from '@/lib/phone';

export async function PUT(req, { params }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const updateData = await req.json();

    const phone = normalizePhone(updateData.phone);
    if (!phone) return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    if (updateData.membershipLevel && !['FREE', 'PRO'].includes(updateData.membershipLevel)) {
      return NextResponse.json({ error: '会员等级只支持 FREE 或 PRO' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: '未找到该用户' }, { status: 404 });
    }

    if (user.phone !== phone) {
      const existing = await User.findOne({ phone });
      if (existing) {
        return NextResponse.json({ error: '该手机号已被其他账号使用' }, { status: 400 });
      }
    }

    user.phone = phone;
    user.email = `phone-${phone}@account.officegpt.invalid`;
    user.phoneVerifiedAt ||= new Date();
    if (updateData.membershipLevel) user.membershipLevel = updateData.membershipLevel;
    if (updateData.balance !== undefined) user.balance = updateData.balance;
    if (updateData.password) {
      user.password = updateData.password; // pre-save hook handles hashing
      user.phonePasswordEnabledAt = new Date();
    }

    await user.save();

    return NextResponse.json({ success: true, message: '用户信息已更新' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const admin = await getCurrentAdmin();
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
