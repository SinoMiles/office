import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SystemSetting from '@/models/SystemSetting';

export async function GET(req) {
  try {
    const requestUrl = new URL(req.url);
    const embedded = requestUrl.searchParams.get('embed') === '1';
    await connectToDatabase();
    const settings = await SystemSetting.find();
    const wechatSetting = settings.find(s => s.key === 'wechat')?.value || {};
    
    if (!wechatSetting.appId || !wechatSetting.appSecret) {
      if (embedded) {
        return new NextResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>body{margin:0;min-height:310px;display:grid;place-items:center;font-family:system-ui;color:#64748b;background:#f8fafc}.box{text-align:center;padding:24px}.icon{font-size:34px;margin-bottom:12px}strong{display:block;color:#0f172a;margin-bottom:8px}</style></head><body><div class="box"><div class="icon">⌁</div><strong>微信登录尚未配置</strong><span>请先在管理后台填写 AppID 和 AppSecret</span></div></body></html>`, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      return NextResponse.json({ error: '微信登录尚未配置' }, { status: 503 });
    }

    const callbackUrl = new URL('/api/auth/wechat/callback', req.url);
    if (embedded) callbackUrl.searchParams.set('embed', '1');
    const redirectUri = encodeURIComponent(callbackUrl.toString());
    const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(wechatSetting.appId)}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${embedded ? 'EMBED' : 'LOGIN'}#wechat_redirect`;
    
    return NextResponse.redirect(wechatUrl);
  } catch (error) {
    return NextResponse.json({ error: '微信登录初始化失败' }, { status: 500 });
  }
}
