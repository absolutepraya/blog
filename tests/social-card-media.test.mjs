import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { composeCard, extractVisualSources, prepareVisuals, visualLayout } from '../scripts/social-card-media.mjs';

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

test('prepareVisuals skips missing files and returns a 16:9 image crop', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'social-card-'));
  const imagesDir = join(workDir, 'images');
  await mkdir(imagesDir);
  const source = join(imagesDir, 'source.png');
  await sharp({
    create: { width: 40, height: 20, channels: 4, background: '#268bd2' },
  }).png().toFile(source);

  const warnings = [];
  const visuals = await prepareVisuals({
    sources: [
      { kind: 'image', value: '/images/source.png' },
      { kind: 'image', value: '/images/missing.png' },
    ],
    staticDir: workDir,
    workDir,
    ratio: '16:9',
    warn: (message) => warnings.push(message),
  });

  const metadata = await sharp(visuals[0]).metadata();
  assert.equal(visuals.length, 1);
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 226, height: 127 });
  assert.equal(warnings.length, 1);
  await rm(workDir, { recursive: true, force: true });
});

test('prepareVisuals chooses a square crop when one source survives', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'social-card-'));
  const imagesDir = join(workDir, 'images');
  await mkdir(imagesDir);
  await sharp({
    create: { width: 40, height: 20, channels: 4, background: '#268bd2' },
  }).png().toFile(join(imagesDir, 'source.png'));

  const visuals = await prepareVisuals({
    sources: [
      { kind: 'image', value: '/images/missing.png' },
      { kind: 'image', value: '/images/source.png' },
    ],
    staticDir: workDir,
    workDir,
    warn: () => {},
  });

  const metadata = await sharp(visuals[0]).metadata();
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 220, height: 220 });
  await rm(workDir, { recursive: true, force: true });
});

test('composeCard produces a 1200 by 630 PNG with a visual rail', async () => {
  const visual = await sharp({
    create: { width: 226, height: 127, channels: 4, background: '#268bd2' },
  }).png().toBuffer();
  const card = await composeCard({ visuals: [visual, visual, visual] });
  const metadata = await sharp(card).metadata();
  assert.deepEqual(
    { width: metadata.width, height: metadata.height, format: metadata.format },
    { width: 1200, height: 630, format: 'png' },
  );
});
