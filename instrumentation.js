export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAioncore } = await import('./lib/aioncore/launcher.js');
    await startAioncore();
  }
}
