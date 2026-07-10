import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SystemSetting from '@/models/SystemSetting';

export async function GET(req) {
  try {
    await connectToDatabase();
    const settings = await SystemSetting.find();
    const wechatSetting = settings.find(s => s.key === 'wechat')?.value || {};
    
    // 如果没有配置，使用 mock redirect 进行本地开发测试
    if (!wechatSetting.appId || !wechatSetting.appSecret) {
      const mockCode = 'dev_mock_code_' + Date.now();
      const callbackUrl = new URL(`/api/auth/wechat/callback?code=${mockCode}`, req.url);
      return NextResponse.redirect(callbackUrl.toString());
    }

    const redirectUri = encodeURIComponent(new URL('/api/auth/wechat/callback', req.url).toString());
    const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${wechatSetting.appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`;
    
    return NextResponse.redirect(wechatUrl);
  } catch (error) {
    return NextResponse.json({ error: 'WeChat Login Error' }, { status: 500 });
  }
}
