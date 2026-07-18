import test from 'node:test';
import assert from 'node:assert/strict';

test('subtractUsage charges only the unbilled conversation usage', async () => {
  const source = await import('../lib/aioncore/session-usage.js');
  const usage = source.subtractUsage(
    { input_tokens: 120, output_tokens: 40, cache_read_tokens: 30, cache_write_tokens: 0 },
    [{ billing: { usage: { inputTokens: 70, outputTokens: 10, cachedInputTokens: 20 } } }],
  );
  assert.deepEqual(usage, {
    input_tokens: 50,
    output_tokens: 30,
    cache_read_tokens: 10,
    cache_write_tokens: 0,
  });
});
