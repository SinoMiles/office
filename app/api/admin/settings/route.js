import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import SystemSetting from '@/models/SystemSetting';
import { normalizeBillingSettings } from '@/lib/billing/pricing';
import { syncLlmProviderToAioncore } from '@/lib/aioncore/provider-sync';

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();
    const settings = await SystemSetting.find();
    
    const wechatPayRequired = ['WECHAT_PAY_APP_ID', 'WECHAT_PAY_MCH_ID', 'WECHAT_PAY_CERT_SERIAL_NO', 'WECHAT_PAY_API_V3_KEY', 'WECHAT_PAY_NOTIFY_URL'];
    const missingWechatPay = wechatPayRequired.filter((name) => !process.env[name]);
    if (!process.env.WECHAT_PAY_PRIVATE_KEY && !process.env.WECHAT_PAY_PRIVATE_KEY_FILE) missingWechatPay.push('WECHAT_PAY_PRIVATE_KEY/FILE');
    if (!process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY && !process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE) missingWechatPay.push('WECHAT_PAY_PLATFORM_PUBLIC_KEY/FILE');
    return NextResponse.json({ success: true, settings, wechatPay: { configured: missingWechatPay.length === 0, missing: missingWechatPay, notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '' } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates = await req.json(); // array of { key, value }
    await connectToDatabase();
    
    for (const update of updates) {
      const normalizedValue = update.key === 'billing' ? normalizeBillingSettings(update.value) : update.value;
      await SystemSetting.findOneAndUpdate(
        { key: update.key },
        { value: normalizedValue },
        { upsert: true }
      );

      // 同步 LLM 配置到 AionCore。同一段逻辑在服务启动时也会跑一次
      // （见 lib/aioncore/provider-sync.js），避免 AionCore 数据重建后配置丢失。
      if (update.key === 'llm') {
        try {
          await syncLlmProviderToAioncore(normalizedValue || {});
        } catch (err) {
          console.error('Failed to sync LLM provider to AionCore:', err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
