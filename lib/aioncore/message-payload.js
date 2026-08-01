export function buildAioncoreMessagePayload({ content, attachments = [] }) {
  const files = attachments.map((attachment) => {
    if (!attachment.uploadPath) throw new Error('AIONCORE_UPLOAD_PATH_REQUIRED');
    return { kind: 'upload', path: attachment.uploadPath };
  });
  return {
    content,
    files,
  };
}
