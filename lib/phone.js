// 手机号归一化。单独成文件是为了能被 node --test 直接导入 ——
// lib/auth-security.js 带 'server-only'，测试里 import 不进来。

// 统一收成 11 位号码：用户会连着国际区号、空格或横线一起粘进来，
// 不归一化的话同一个号码能以好几种写法绕过唯一索引。
export function normalizePhone(value) {
  const digits = String(value || '').replace(/[\s-]/g, '').replace(/^\+?86/, '');
  return /^1[3-9]\d{9}$/.test(digits) ? digits : '';
}
