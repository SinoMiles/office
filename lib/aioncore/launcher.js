import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let aioncoreProcess = null;
let aioncorePort = 9123;

export async function getAioncorePort() {
  if (!aioncoreProcess) {
    await startAioncore();
  }
  return aioncorePort;
}

export async function startAioncore() {
  if (aioncoreProcess) return;

  const binPath = path.join(process.cwd(), 'bin', 'aioncore');
  const dataDir = path.join(process.cwd(), 'storage', 'aioncore-data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Find an available port or just use 9123
  aioncorePort = process.env.AIONCORE_PORT || 9123;

  const args = [
    '--port', aioncorePort.toString(),
    '--data-dir', dataDir,
    '--log-level', process.env.AIONCORE_LOG_LEVEL || 'info',
    '--app-version', '1.0.0',
    '--local'
  ];

  console.log(`Starting aioncore: ${binPath} ${args.join(' ')}`);

  aioncoreProcess = spawn(binPath, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  aioncoreProcess.stdout.on('data', (data) => {
    const text = data.toString();
    console.log(`[aioncore] ${text.trim()}`);
  });

  aioncoreProcess.stderr.on('data', (data) => {
    const text = data.toString();
    console.error(`[aioncore ERR] ${text.trim()}`);
  });

  aioncoreProcess.on('exit', (code) => {
    console.log(`aioncore exited with code ${code}`);
    aioncoreProcess = null;
  });

  // Wait a moment for it to start
  await new Promise(resolve => setTimeout(resolve, 1000));
}

export function stopAioncore() {
  if (aioncoreProcess) {
    aioncoreProcess.kill('SIGTERM');
    aioncoreProcess = null;
  }
}
