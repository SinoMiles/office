import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { cancelAutoRenew, resumeAutoRenew } from '@/lib/billing/subscription-service';

export const runtime = 'nodejs';

// 手动续费模式下「取消订阅」= 关闭到期提醒。已付费的周期照常有效到期末，不做按比例退款；
// 需要退钱的场景走管理端退款流程。
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { resume } = await request.json().catch(() => ({}));
  await connectToDatabase();
  const subscription = resume ? await resumeAutoRenew(user._id) : await cancelAutoRenew(user._id);
  if (!subscription) return NextResponse.json({ error: '没有可操作的有效订阅' }, { status: 404 });
  return NextResponse.json({
    success: true,
    autoRenew: subscription.autoRenew,
    currentPeriodEnd: subscription.currentPeriodEnd,
    message: subscription.autoRenew ? '已恢复到期提醒' : `已关闭续订，会员权益保留至 ${new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}`,
  });
}
