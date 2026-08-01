import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_STARTUP_DELAY_SECONDS = 60;

function enabled() {
  const configured = process.env.OFFICECLI_AUTO_UPDATE;
  if (configured === undefined) return process.env.NODE_ENV === 'production';
  return !['0', 'false', 'off', 'no'].includes(configured.trim().toLowerCase());
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function startOfficecliUpdater() {
  if (!enabled()) {
    console.log('[officecli:scheduler] automatic updates disabled');
    return null;
  }

  const script = path.join(process.cwd(), 'scripts', 'update-officecli.mjs');
  const intervalMs = positiveNumber(process.env.OFFICECLI_UPDATE_INTERVAL_HOURS, DEFAULT_INTERVAL_HOURS) * 3_600_000;
  const startupDelayMs = positiveNumber(process.env.OFFICECLI_UPDATE_STARTUP_DELAY_SECONDS, DEFAULT_STARTUP_DELAY_SECONDS) * 1_000;
  let running = false;

  const check = () => {
    if (running) return;
    running = true;
    console.log('[officecli:scheduler] checking for updates');
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', (error) => {
      running = false;
      console.error(`[officecli:scheduler] failed to start updater: ${error.message}`);
    });
    child.once('exit', (code, signal) => {
      running = false;
      if (code === 0) console.log('[officecli:scheduler] update check finished');
      else console.error(`[officecli:scheduler] updater exited with ${signal || `code ${code}`}`);
    });
  };

  const startupTimer = setTimeout(check, startupDelayMs);
  const intervalTimer = setInterval(check, intervalMs);
  startupTimer.unref();
  intervalTimer.unref();
  console.log(`[officecli:scheduler] enabled; first check in ${Math.round(startupDelayMs / 1_000)}s, then every ${(intervalMs / 3_600_000).toFixed(1)}h`);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalTimer);
  };
}
