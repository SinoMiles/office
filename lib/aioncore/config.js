export function getAioncoreBaseUrl() {
  const port = process.env.AIONCORE_PORT || 9123;
  return process.env.AIONCORE_URL || `http://127.0.0.1:${port}`;
}

