import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import SystemSetting from '@/models/SystemSetting';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import BillingRecord from '@/models/BillingRecord';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    await connectToDatabase();
    let openid = '';
    
    if (code.startsWith('dev_mock_code_')) {
      // Mock flow for local dev
      openid = 'mock_openid_' + Math.random().toString(36).substr(2, 9);
    } else {
      // Real WeChat OAuth flow
      const settings = await SystemSetting.find();
      const wechatSetting = settings.find(s => s.key === 'wechat')?.value || {};
      
      const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${wechatSetting.appId}&secret=${wechatSetting.appSecret}&code=${code}&grant_type=authorization_code`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();
      
      if (tokenData.errcode) {
        return NextResponse.json({ error: tokenData.errmsg }, { status: 400 });
      }
      openid = tokenData.openid;
    }

    // Find or create user
    let user = await User.findOne({ wechatOpenId: openid });
    if (!user) {
      user = await User.create({
        email: `wx_${openid}@officegpt.local`,
        password: Math.random().toString(36).slice(-8), // random dummy password
        wechatOpenId: openid,
        balance: 10000,
        role: 'user'
      });
      await BillingRecord.create({ userId: user._id, type: 'charge', amount: 10000, balanceDelta: 10000, balanceBefore: 0, balanceAfter: 10000, description: '新用户注册赠送', idempotencyKey: `signup:${user._id}` });
    }

    const token = signToken({ id: user._id, role: user.role });
    const redirectUrl = new URL('/dashboard', req.url);
    const response = NextResponse.redirect(redirectUrl.toString());
    
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;

  } catch (error) {
    return NextResponse.json({ error: 'WeChat Callback Error' }, { status: 500 });
  }
}
