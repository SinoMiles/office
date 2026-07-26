import 'server-only';
import nodemailer from 'nodemailer';

function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user, pass },
  });
}

export async function sendVerificationEmail({ email, code, purpose }) {
  const client = transport();
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[auth:email] ${purpose} code for ${email}: ${code}`);
      return;
    }
    throw new Error('邮件服务尚未配置');
  }
  const title = purpose === 'register' ? '验证您的 OfficeGPT 邮箱' : '重置您的 OfficeGPT 密码';
  await client.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: title,
    text: `您的验证码是 ${code}，10 分钟内有效。请勿将验证码告诉任何人。`,
    html: `<div style="font-family:system-ui;max-width:520px;margin:auto;padding:28px"><h2>${title}</h2><p>您的验证码：</p><div style="font-size:30px;font-weight:800;letter-spacing:8px">${code}</div><p style="color:#64748b">验证码 10 分钟内有效，请勿将验证码告诉任何人。</p></div>`,
  });
}

function siteUrl(path = '') {
  const base = String(process.env.SITE_URL || 'https://officegpt.cn').replace(/\/$/, '');
  return `${base}${path}`;
}

function layout({ title, body, action }) {
  const button = action
    ? `<p style="margin:24px 0"><a href="${action.href}" style="display:inline-block;padding:12px 22px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">${action.label}</a></p>`
    : '';
  return `<div style="font-family:system-ui;max-width:560px;margin:auto;padding:28px;color:#0f172a"><h2 style="margin:0 0 16px">${title}</h2>${body}${button}<p style="color:#94a3b8;font-size:12px;margin-top:28px;border-top:1px solid #e2e8f0;padding-top:14px">这是一封系统通知邮件，请勿直接回复。</p></div>`;
}

// 交易类邮件不应该因为 SMTP 抖动就中断主流程（订阅已经生效了），
// 因此这里只记录失败，由调用方决定是否重试。
async function deliver({ to, subject, text, html }) {
  const client = transport();
  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[billing:email] ${subject} -> ${to}`);
      return { sent: false, reason: 'smtp_not_configured' };
    }
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    await client.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error('[billing:email] 发送失败', error);
    return { sent: false, reason: error.message };
  }
}

export async function sendSubscriptionActivatedEmail({ email, planName, periodLabel, currentPeriodEnd, grantCredits }) {
  const endText = new Date(currentPeriodEnd).toLocaleDateString('zh-CN');
  const title = `${planName} 已开通`;
  return deliver({
    to: email,
    subject: `OfficeGPT · ${title}`,
    text: `您的 ${planName}（${periodLabel}）已开通，有效期至 ${endText}，${grantCredits} Credits 已到账。`,
    html: layout({
      title,
      body: `<p>您的 <b>${planName}</b>（${periodLabel}）已成功开通。</p><ul style="line-height:1.9;color:#334155"><li>有效期至：<b>${endText}</b></li><li>本期赠送额度：<b>${Number(grantCredits).toLocaleString('zh-CN')} Credits</b>（已到账）</li></ul>`,
      action: { href: siteUrl('/dashboard/billing'), label: '查看我的账单' },
    }),
  });
}

export async function sendSubscriptionReminderEmail({ email, planName, daysLeft, currentPeriodEnd }) {
  const endText = new Date(currentPeriodEnd).toLocaleDateString('zh-CN');
  const title = `${planName} 将在 ${daysLeft} 天后到期`;
  return deliver({
    to: email,
    subject: `OfficeGPT · ${title}`,
    text: `您的 ${planName} 将于 ${endText} 到期。到期后账号将自动降级为免费版，Token 折扣与每月赠送额度将同时停止。`,
    html: layout({
      title,
      body: `<p>您的 <b>${planName}</b> 将于 <b>${endText}</b> 到期。</p><p style="color:#334155">到期后账号会自动降级为免费版，Token 折扣与每月赠送额度将同时停止。已充值的 Credits 余额不受影响，可继续使用。</p>`,
      action: { href: siteUrl('/dashboard/billing'), label: '立即续费' },
    }),
  });
}

export async function sendSubscriptionExpiredEmail({ email, planName }) {
  const title = `${planName} 已到期`;
  return deliver({
    to: email,
    subject: `OfficeGPT · ${title}`,
    text: `您的 ${planName} 已到期，账号已降级为免费版。已充值的 Credits 余额不受影响。`,
    html: layout({
      title,
      body: `<p>您的 <b>${planName}</b> 已到期，账号已降级为免费版。</p><p style="color:#334155">已充值的 Credits 余额不受影响，可继续使用。重新订阅即可恢复折扣与每月赠送额度。</p>`,
      action: { href: siteUrl('/dashboard/billing'), label: '重新订阅' },
    }),
  });
}

export async function sendRefundNotificationEmail({ email, amountYuan, outTradeNo, clawbackCredits }) {
  const title = '退款已处理';
  return deliver({
    to: email,
    subject: 'OfficeGPT · 退款已处理',
    text: `订单 ${outTradeNo} 的 ¥${amountYuan} 退款已提交，将原路退回您的微信支付账户。`,
    html: layout({
      title,
      body: `<p>订单 <code>${outTradeNo}</code> 的退款已处理。</p><ul style="line-height:1.9;color:#334155"><li>退款金额：<b>¥${amountYuan}</b>（原路退回微信支付账户，通常 1–3 个工作日到账）</li><li>扣回额度：<b>${Number(clawbackCredits).toLocaleString('zh-CN')} Credits</b></li></ul>`,
    }),
  });
}
