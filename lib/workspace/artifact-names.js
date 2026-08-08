const TRANSIENT_MARKERS = ['.batchprep-', '.officegpt-temp-', '.partial.'];

export function isTransientWorkspaceArtifact(value = '') {
  const normalized = String(value).replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length) return false;
  const basename = parts.at(-1).toLowerCase();
  const directories = parts.slice(0, -1);
  if (directories.some((part) => part.startsWith('.'))) return true;
  if (basename.startsWith('.') || basename.startsWith('~$')) return true;
  if (TRANSIENT_MARKERS.some((marker) => basename.includes(marker))) return true;
  return /\.(?:tmp|temp|partial)$/i.test(basename);
}
