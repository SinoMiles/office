// mupdf 是 WASM 实现，没有任何系统依赖 —— 这正是选它替代
// pdftoppm(poppler) 与 qpdf 的原因：主镜像不需要额外 apt 包，Windows 开发机也能跑。
// 包本身是 ESM 且带顶层 await，必须动态 import，不能在模块顶层静态引入。
let modulePromise = null;
function loadMupdf() {
  modulePromise ||= import('mupdf');
  return modulePromise;
}

const MAX_RENDER_PAGES = 200;

function openDocument(mupdf, buffer) {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  // 加密文档在没有口令时无法渲染或提取，提前给出可读的提示。
  if (doc.needsPassword?.() && !doc.authenticatePassword('')) {
    throw new Error('该 PDF 已加密，请先移除密码后再处理');
  }
  return doc;
}

/**
 * 逐页渲染 PDF 为图片。format 取 'png' 或 'jpeg'，dpi 默认 150。
 * 返回 [{ name, data }]，交给调用方决定打包方式。
 */
export async function renderPdfPages(buffer, { format = 'png', dpi = 150 } = {}) {
  const mupdf = await loadMupdf();
  const doc = openDocument(mupdf, buffer);
  const total = doc.countPages();
  if (!total) throw new Error('PDF 中没有可渲染的页面');
  // 上限保护：一份几百页的文档逐页渲染会吃满内存，也会让请求长时间挂住。
  const pages = Math.min(total, MAX_RENDER_PAGES);
  const scale = dpi / 72;
  const matrix = mupdf.Matrix.scale(scale, scale);
  const images = [];
  for (let index = 0; index < pages; index += 1) {
    const page = doc.loadPage(index);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    const data = format === 'png' ? pixmap.asPNG() : pixmap.asJPEG(85, false);
    images.push({ name: `page-${String(index + 1).padStart(3, '0')}.${format === 'png' ? 'png' : 'jpg'}`, data: Buffer.from(data) });
    pixmap.destroy?.();
    page.destroy?.();
  }
  doc.destroy?.();
  return { images, total, rendered: pages };
}

/**
 * 提取 PDF 文本。相比原先的 pdf-parse@1.1.1（内置 2018 年的 pdf.js），
 * mupdf 能正确读取本站 pdf-lib 工具生成的 PDF。
 */
export async function extractPdfText(buffer) {
  const mupdf = await loadMupdf();
  const doc = openDocument(mupdf, buffer);
  const parts = [];
  for (let index = 0; index < doc.countPages(); index += 1) {
    const page = doc.loadPage(index);
    parts.push(page.toStructuredText().asText());
    page.destroy?.();
  }
  doc.destroy?.();
  return parts.join('\n').trim();
}

/**
 * 为 PDF 设置打开密码（AES-256）。
 * permissions=-1 表示保留全部操作权限，只限制打开。
 */
export async function encryptPdf(buffer, password) {
  if (!password || password.length < 6) throw new Error('密码至少需要 6 个字符');
  const mupdf = await loadMupdf();
  const doc = mupdf.PDFDocument.openDocument(buffer, 'application/pdf');
  if (doc.needsPassword?.() && !doc.authenticatePassword('')) {
    throw new Error('该 PDF 已有密码，请先解密后再设置');
  }
  const escaped = String(password).replace(/([,=\\])/g, '\\$1');
  const saved = doc.saveToBuffer(`encrypt=aes-256,user-password=${escaped},owner-password=${escaped},permissions=-1`);
  const bytes = Buffer.from(saved.asUint8Array());
  doc.destroy?.();
  return bytes;
}

export async function isMupdfAvailable() {
  try {
    await loadMupdf();
    return true;
  } catch {
    return false;
  }
}
