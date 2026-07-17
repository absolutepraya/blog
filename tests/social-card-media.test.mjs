import test from 'node:test';
import assert from 'node:assert/strict';

test('social card media module loads', async () => {
  const media = await import('../scripts/social-card-media.mjs');
  assert.equal(typeof media.extractVisualSources, 'function');
  assert.equal(typeof media.visualLayout, 'function');
});
