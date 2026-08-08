import { isUserVisibleDocument } from '../workspace/path-policy.js';
import { isTransientWorkspaceArtifact } from '../workspace/artifact-names.js';

function extensionOf(filename = '') {
  const match = String(filename).toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || 'file';
}

export function attachmentView(task, attachment, index = 0) {
  if (!task?._id || !attachment?.filename) return null;
  const taskId = String(task._id);
  const fileType = extensionOf(attachment.filename);
  const officeFile = ['ppt', 'pptx', 'word', 'doc', 'docx', 'excel', 'xls', 'xlsx'].includes(fileType);
  const attachmentKey = `attachment-${index}`;
  const fileUrl = `/api/tasks/${taskId}/download?attachmentIndex=${index}`;
  return {
    id: `${taskId}:${attachmentKey}`, taskId, attachmentIndex: index,
    filename: attachment.filename, fileType, previewType: fileType, status: 'ready',
    previewUrl: officeFile ? `/api/tasks/${taskId}/office-preview/attachment/${index}/` : `${fileUrl}&inline=1`,
    downloadUrl: fileUrl, live: officeFile, generic: !officeFile,
  };
}

export function artifactView(task, artifact) {
  if (!task?._id || !artifact) return null;
  const taskId = String(task._id);
  const artifactId = artifact._id ? String(artifact._id) : null;
  const filename = artifact.filename || task.outputFilename || String(artifact.filePath || task.outputFile || '').split('/').pop();
  if (!filename || !isUserVisibleDocument(filename) || isTransientWorkspaceArtifact(artifact.filePath || filename)) return null;
  const routeId = artifactId ? `/${artifactId}` : '';
  const fileType = artifact.fileType || extensionOf(filename);
  const officeFile = ['ppt', 'pptx', 'word', 'doc', 'docx', 'excel', 'xls', 'xlsx'].includes(fileType);
  const genericPath = encodeURIComponent(artifact.filePath || '');
  return {
    id: `${taskId}:${artifactId || 'legacy'}`,
    taskId,
    artifactId,
    filename,
    fileType,
    previewType: fileType,
    status: artifact.status || (task.status === 'completed' ? 'ready' : 'generating'),
    previewUrl: officeFile
      ? `/api/tasks/${taskId}/office-preview/proxy${routeId}/`
      : `/api/tasks/${taskId}/workspace/file?path=${genericPath}`,
    downloadUrl: officeFile
      ? `/api/tasks/${taskId}/download${artifactId ? `?artifactId=${encodeURIComponent(artifactId)}` : ''}`
      : `/api/tasks/${taskId}/workspace/file?path=${genericPath}&download=1`,
    live: officeFile,
    generic: !officeFile,
    previewVersion: new Date(artifact.updatedAt || task.runtime?.updatedAt || task.updatedAt || 0).getTime(),
  };
}

export function taskArtifactViews(task) {
  if (!task) return [];
  if (Array.isArray(task.artifacts) && task.artifacts.length) {
    return task.artifacts.map((artifact) => artifactView(task, artifact)).filter(Boolean);
  }
  if (task.outputFile) {
    return [artifactView(task, { filePath: task.outputFile, filename: task.outputFilename })].filter(Boolean);
  }
  if (task.previewFile) {
    return [{
      id: `${task._id}:preview`, taskId: String(task._id), filename: task.outputFilename || '预览文件',
      fileType: extensionOf(task.outputFilename), status: 'ready',
      previewUrl: `/api/tasks/${task._id}/preview`, live: false,
      previewVersion: new Date(task.updatedAt || 0).getTime(),
    }];
  }
  return [];
}

export function attachArtifactsToMessages(messages, turns) {
  const result = (messages || []).map((message) => ({ ...message }));
  let turnIndex = 0;
  for (const message of result) {
    const turn = turns?.[turnIndex];
    if (message.role === 'user') {
      const persistedAttachments = turn?.attachments?.length
        ? turn.attachments
        : turn?.filename ? [{ filename: turn.filename, filePath: turn.originalFile }] : [];
      const persistedNames = persistedAttachments.map((attachment) => attachment.filename);
      const filenames = [...new Set([...(message.filenames || []), ...(message.filename ? [message.filename] : []), ...persistedNames].filter(Boolean))];
      if (filenames.length) {
        message.filename = filenames[0];
        message.filenames = filenames;
      }
      const attachmentViews = persistedAttachments.map((attachment, index) => attachmentView(turn, attachment, index)).filter(Boolean);
      if (attachmentViews.length) message.attachments = attachmentViews;
      continue;
    }
    if (message.role !== 'ai') continue;
    const artifacts = taskArtifactViews(turn);
    if (artifacts.length) message.artifacts = artifacts;
    turnIndex += 1;
  }
  return result;
}
