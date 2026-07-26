import path from 'node:path';

// docker-compose 里一直起着 Gotenberg 容器（自带 LibreOffice + Chromium），
// 但此前没有任何代码调用它 —— 转换全走本地 `soffice` 子进程，而基础镜像并不装 LibreOffice。
// 改为走 Gotenberg 后，转换能力不再依赖主镜像里的系统包。

const OFFICE_EXTENSIONS = new Set([
  '.doc', '.docx', '.odt', '.rtf',
  '.xls', '.xlsx', '.ods', '.csv',
  '.ppt', '.pptx', '.odp',
]);

export function gotenbergBaseUrl() {
  return (process.env.GOTENBERG_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
}

export function isOfficeExtension(extension) {
  return OFFICE_EXTENSIONS.has(String(extension || '').toLowerCase());
}

export async function isGotenbergAvailable() {
  try {
    const response = await fetch(`${gotenbergBaseUrl()}/health`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.details?.libreoffice?.status !== 'down';
  } catch {
    return false;
  }
}

/**
 * 把 Office 文档转换为 PDF，返回 Buffer。
 * timeoutMs 覆盖大文件场景；Gotenberg 侧本身也有超时，这里只做客户端保护。
 */
export async function convertToPdfBuffer(file, { timeoutMs = 120_000 } = {}) {
  const extension = path.extname(file?.name || '').toLowerCase();
  if (!file || !isOfficeExtension(extension)) throw new Error('请上传 Word、Excel 或 PowerPoint 文件');

  const form = new FormData();
  // Gotenberg 依据上传文件的扩展名选择转换引擎，文件名必须保留后缀。
  form.append('files', new File([Buffer.from(await file.arrayBuffer())], `document${extension}`));
  form.append('landscape', 'false');

  let response;
  try {
    response = await fetch(`${gotenbergBaseUrl()}/forms/libreoffice/convert`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    const failure = new Error(timedOut ? '文档转换超时，请尝试更小的文件' : '文档转换服务不可用，请稍后重试');
    failure.cause = error;
    throw failure;
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().slice(0, 200);
    throw new Error(detail || `文档转换失败（${response.status}）`);
  }
  return Buffer.from(await response.arrayBuffer());
}
