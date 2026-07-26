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
