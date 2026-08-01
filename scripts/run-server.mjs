import path from 'node:path';
import fs from 'node:fs';

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

// Development uses the locally built OfficeGPT Core fork when available.
// Production remains explicitly configured and never picks up a sibling build.
const localOfficegptCore = path.resolve(process.cwd(), '..', 'officegpt-core', 'target', 'debug', process.platform === 'win32' ? 'aioncore.exe' : 'aioncore');
if (mode === 'development' && fs.existsSync(localOfficegptCore)) {
  process.env.AIONCORE_BIN ||= localOfficegptCore;
  console.log(`OfficeGPT Core development runtime: ${process.env.AIONCORE_BIN}`);
}

const { configureOfficecliRuntime } = await import('../lib/office/runtime-path.js');
const officecliRuntime = configureOfficecliRuntime();
if (officecliRuntime) console.log(`OfficeCLI shared runtime: ${officecliRuntime.current}`);

const { startOfficecliUpdater } = await import('../lib/office/runtime-updater.js');
startOfficecliUpdater();

await import('../server.mjs');
