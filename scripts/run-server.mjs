import path from 'node:path';

const mode = process.argv[2] === 'production' ? 'production' : 'development';

try {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

process.env.NODE_ENV = mode;
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/officecli_saas';
process.env.GOTENBERG_URL ||= 'http://127.0.0.1:3001';
process.env.STORAGE_DIR ||= path.join(process.cwd(), 'storage');

await import('../server.mjs');
