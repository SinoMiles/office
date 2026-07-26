import path from 'node:path';
import JSZip from 'jszip';

// 工具链已不再调用任何系统命令（原先依赖 soffice / pdftoppm / zip / unzip / qpdf），
// 因此这里也不再导出 execFileAsync 与 withTempDir。

export const MIME_TYPES = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  zip: 'application/zip',
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

export function output(body, filename, type) {
  return { body, filename, contentType: MIME_TYPES[type] };
}

/**
 * 打包成 zip。以前这里 spawn 系统的 `zip` 命令，但 node:24-slim 基础镜像并不带它，
 * 导致所有产出压缩包的工具在生产环境直接 ENOENT。改用 jszip 后无任何系统依赖。
 */
export async function zipBuffers(items, _filename) {
  const zip = new JSZip();
  const used = new Map();
  for (const item of items) {
    // 同名条目（例如两页导出成同一个文件名）在 zip 里会互相覆盖，这里补序号去重。
    const base = path.basename(item.name);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    zip.file(count === 0 ? base : `${count + 1}-${base}`, item.data);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * 读取 OOXML/zip 包中匹配前缀的条目。同样从 `unzip` 子进程换成纯 JS。
 */
export async function readZipEntries(buffer, prefix) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files)
    .filter((name) => name.startsWith(prefix) && !zip.files[name].dir)
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  return Promise.all(entries.map(async (entry) => ({ entry, data: await zip.files[entry].async('nodebuffer') })));
}
