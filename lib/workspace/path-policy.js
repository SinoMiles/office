import path from 'node:path';

export function normalizeWorkspacePath(value = '') {
  if (!String(value || '').trim()) return '';
  const resolved = path.resolve(String(value || ''));
  if (resolved === '/private/var') return '/var';
  if (resolved.startsWith('/private/var/')) return resolved.slice('/private'.length);
  if (resolved === '/private/tmp') return '/tmp';
  if (resolved.startsWith('/private/tmp/')) return resolved.slice('/private'.length);
  return resolved;
}

export function taskWorkspace(task) {
  return normalizeWorkspacePath(task?.workspace || task?.artifacts?.find((item) => item.workspace)?.workspace || (task?.originalFile ? path.dirname(task.originalFile) : ''));
}

export function resolveWorkspaceEntry(workspace, requestedPath) {
  const root = normalizeWorkspacePath(workspace);
  const candidate = normalizeWorkspacePath(path.isAbsolute(String(requestedPath || '')) ? requestedPath : path.join(root, String(requestedPath || '')));
  if (!root || root === path.parse(root).root || (candidate !== root && !candidate.startsWith(`${root}${path.sep}`))) {
    throw new Error('PATH_OUTSIDE_WORKSPACE');
  }
  return { root, candidate };
}

export function previewType(filename = '') {
  const extension = path.extname(filename).toLowerCase();
  if (['.pptx'].includes(extension)) return 'ppt';
  if (['.docx'].includes(extension)) return 'word';
  if (['.xlsx', '.xls'].includes(extension)) return 'excel';
  if (extension === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) return 'image';
  if (['.md', '.markdown'].includes(extension)) return 'markdown';
  if (['.html', '.htm'].includes(extension)) return 'html';
  if (['.txt', '.json', '.csv', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.xml', '.yaml', '.yml'].includes(extension)) return 'text';
  return 'download';
}

const USER_VISIBLE_DOCUMENT_EXTENSIONS = new Set([
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.md', '.markdown',
]);

export function isUserVisibleDocument(filename = '') {
  return USER_VISIBLE_DOCUMENT_EXTENSIONS.has(path.extname(String(filename)).toLowerCase());
}
