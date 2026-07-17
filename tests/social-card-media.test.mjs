import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisualSources, visualLayout } from '../scripts/social-card-media.mjs';

test('social card media module loads', async () => {
  const media = await import('../scripts/social-card-media.mjs');
  assert.equal(typeof media.extractVisualSources, 'function');
  assert.equal(typeof media.visualLayout, 'function');
});

test('extractVisualSources keeps local images, figures, and Mermaid blocks in body order', () => {
  const body = [
    '![first](/images/first.png)',
    '![remote](https://example.com/remote.png)',
    '{{< figure src="/images/second.jpg" alt="second" >}}',
    '```mermaid\ngraph TD\n  A --> B\n```',
  ].join('\n\n');

  assert.deepEqual(extractVisualSources(body), [
    { kind: 'image', value: '/images/first.png' },
    { kind: 'image', value: '/images/second.jpg' },
    { kind: 'mermaid', value: 'graph TD\n  A --> B' },
  ]);
});

test('visualLayout uses the approved adaptive ratios', () => {
  assert.equal(visualLayout(3).ratio, '16:9');
  assert.equal(visualLayout(2).ratio, '4:3');
  assert.equal(visualLayout(1).ratio, '1:1');
  assert.equal(visualLayout(0).ratio, null);
  assert.equal(visualLayout(3).slots.length, 3);
  assert.equal(visualLayout(0).slots.length, 0);
});
