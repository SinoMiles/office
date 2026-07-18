export function publicErrorMessage(error, fallback = 'OfficeGPT 服务暂时不可用，请稍后重试') {
  const message = String(error?.message || error || '').trim();
  if (!message) return fallback;
  return message
    .replace(/AionCore/giu, 'OfficeGPT')
    .replace(/officecli/giu, 'OfficeGPT');
}
