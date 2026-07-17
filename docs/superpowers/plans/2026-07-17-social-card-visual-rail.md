# Social Card Visual Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate public-post social cards with a contained adaptive visual rail built from local images and Mermaid diagrams.

**Architecture:** Keep `scripts/generate-social-cards.mjs` as the page enumerator and output writer. Add a focused `scripts/social-card-media.mjs` module that extracts local visual sources from Markdown, renders Mermaid sources, produces normalized crops, and composes the final PNG through Sharp. The existing text-only card remains the zero-visual fallback.

**Tech Stack:** Node.js ESM, `node:test`, Sharp, `@resvg/resvg-js`, `@mermaid-js/mermaid-cli`, Hugo, Vercel.

## Global Constraints

- Generate 1200 by 630 PNG cards under the existing gitignored `static/social/` directory.
- Public regular posts only. Private pages remain excluded.
- Respect `social_image` as a whole-card override.
- Eligible sources are local `/images/` Markdown images, local `figure` shortcode images, and Mermaid code blocks in body order.
- Exclude remote image URLs. Skip missing files, unsupported formats, and Mermaid failures with warnings.
- Use centered `cover` crops and square 4px `#93a1a1` visual borders.
- Keep text in the left three quarters and visuals in the contained right quarter.
- Visual layouts: 3 uses 16:9, 2 uses 4:3, 1 uses 1:1, 0 uses full-width text.
- Do not use em dashes in code comments, user-facing copy, documentation, or commits.

---

### Task 1: Add deterministic media dependencies and a Node test command

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/social-card-media.test.mjs`

**Interfaces:**
- Produces the `npm run test:social-cards` command used by later tasks.
- The test file imports named exports from `scripts/social-card-media.mjs` after Task 2.

- [ ] **Step 1: Add the failing test shell**

Create `tests/social-card-media.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('social card media module loads', async () => {
  const media = await import('../scripts/social-card-media.mjs');
  assert.equal(typeof media.extractVisualSources, 'function');
  assert.equal(typeof media.visualLayout, 'function');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/social-card-media.test.mjs`

Expected: FAIL because `scripts/social-card-media.mjs` does not exist.

- [ ] **Step 3: Add build dependencies and test command**

Update `package.json` scripts and dependencies:

```json
{
  "scripts": {
    "build": "node scripts/generate-social-cards.mjs && hugo --minify",
    "generate:social-cards": "node scripts/generate-social-cards.mjs",
    "test:social-cards": "node --test tests/social-card-media.test.mjs"
  },
  "dependencies": {
    "@mermaid-js/mermaid-cli": "^11.16.0",
    "@resvg/resvg-js": "^2.6.2",
    "sharp": "^0.35.3"
  }
}
```

Run: `npm install`

- [ ] **Step 4: Commit the dependency and test scaffold**

```bash
git add package.json package-lock.json tests/social-card-media.test.mjs
git commit -m "Add social card media test scaffold"
```

### Task 2: Extract eligible visuals in source order

**Files:**
- Create: `scripts/social-card-media.mjs`
- Modify: `tests/social-card-media.test.mjs`

**Interfaces:**
- Produces `extractVisualSources(body) => Array<{ kind: 'image' | 'mermaid', value: string }>`.
- Produces `visualLayout(count) => { ratio: string | null, slots: Array<{ x: number, y: number, width: number, height: number, rotation: number }> }`.
- Consumes only raw Markdown body text. It does not read files or render output.

- [ ] **Step 1: Add extraction and layout tests**

Append these tests:

```js
import { extractVisualSources, visualLayout } from '../scripts/social-card-media.mjs';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:social-cards`

Expected: FAIL because the named exports are not implemented.

- [ ] **Step 3: Implement extraction and the fixed rail geometry**

Create `scripts/social-card-media.mjs` with these exported functions:

```js
const rail = { x: 846, y: 184, width: 246, height: 310 };

export function extractVisualSources(body) {
  const pattern = /!\[[^\]]*\]\((\/images\/[^)\s]+)[^)]*\)|{{<\s*figure\s+[^>]*src=["'](\/images\/[^"']+)["'][^>]*>}}|```mermaid\s*\n([\s\S]*?)```/g;
  const sources = [];
  for (const match of body.matchAll(pattern)) {
    if (match[1] || match[2]) sources.push({ kind: 'image', value: match[1] || match[2] });
    if (match[3]) sources.push({ kind: 'mermaid', value: match[3].trim() });
  }
  return sources;
}

export function visualLayout(count) {
  if (count >= 3) return { ratio: '16:9', slots: [
    { x: rail.x + 2, y: rail.y + 4, width: 226, height: 127, rotation: -4 },
    { x: rail.x + 16, y: rail.y + 92, width: 226, height: 127, rotation: 3 },
    { x: rail.x + 2, y: rail.y + 180, width: 226, height: 127, rotation: -2 },
  ] };
  if (count === 2) return { ratio: '4:3', slots: [
    { x: rail.x + 2, y: rail.y + 8, width: 226, height: 170, rotation: -4 },
    { x: rail.x + 16, y: rail.y + 132, width: 226, height: 170, rotation: 3 },
  ] };
  if (count === 1) return { ratio: '1:1', slots: [
    { x: rail.x + 8, y: rail.y + 40, width: 220, height: 220, rotation: -2 },
  ] };
  return { ratio: null, slots: [] };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:social-cards`

Expected: PASS with two tests.

- [ ] **Step 5: Commit source extraction**

```bash
git add scripts/social-card-media.mjs tests/social-card-media.test.mjs
git commit -m "Extract social card visual sources"
```

### Task 3: Render local images and Mermaid diagrams into normalized thumbnails

**Files:**
- Modify: `scripts/social-card-media.mjs`
- Modify: `tests/social-card-media.test.mjs`
- Create: `tests/fixtures/social-card-source.png`
- Create: `scripts/mermaid-social-config.json`

**Interfaces:**
- Produces `prepareVisuals({ sources, staticDir, workDir, ratio, warn }) => Promise<Buffer[]>`.
- Consumes source records from `extractVisualSources` and returns at most three renderable image buffers in source order.
- Uses `warn(message)` for skipped inputs. It never throws for a single bad candidate.

- [ ] **Step 1: Add thumbnail tests**

Add tests that create a 40 by 20 fixture through Sharp, then assert the output crop metadata:

```js
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareVisuals } from '../scripts/social-card-media.mjs';

test('prepareVisuals skips missing files and returns a 16:9 image crop', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'social-card-'));
  const imagesDir = join(workDir, 'images');
  await mkdir(imagesDir);
  const source = join(imagesDir, 'source.png');
  await sharp({ create: { width: 40, height: 20, channels: 4, background: '#268bd2' } }).png().toFile(source);
  const warnings = [];
  const visuals = await prepareVisuals({
    sources: [{ kind: 'image', value: '/images/source.png' }, { kind: 'image', value: '/images/missing.png' }],
    staticDir: workDir,
    workDir,
    ratio: '16:9',
    warn: (message) => warnings.push(message),
  });
  assert.equal(visuals.length, 1);
  assert.deepEqual(await sharp(visuals[0]).metadata().then(({ width, height }) => ({ width, height })), { width: 226, height: 127 });
  assert.equal(warnings.length, 1);
  await rm(workDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:social-cards`

Expected: FAIL because `prepareVisuals` is not exported.

- [ ] **Step 3: Implement normalized image and Mermaid rendering**

Implement `prepareVisuals` so it:

```js
const [width, height] = ratio === '16:9' ? [226, 127] : ratio === '4:3' ? [226, 170] : [220, 220];
const staticPath = join(staticDir, source.value.replace(/^\/images\//, 'images/'));
const buffer = await sharp(staticPath).resize(width, height, { fit: 'cover', position: 'centre' }).png().toBuffer();
```

For Mermaid sources, write a temporary `.mmd` file under `workDir`, create `scripts/mermaid-social-config.json` with this fixed light Solarized configuration, then invoke:

```json
{
  "theme": "base",
  "themeVariables": {
    "background": "#fdf6e3",
    "primaryColor": "#eee8d5",
    "primaryTextColor": "#586e75",
    "lineColor": "#657b83",
    "tertiaryColor": "#fdf6e3"
  }
}
```

```js
execFileSync('npx', ['mmdc', '-i', inputPath, '-o', outputPath, '-c', configPath, '-b', 'transparent'], { stdio: 'pipe' });
```

Read the generated SVG through Sharp and apply the same `resize(..., { fit: 'contain', background: '#fdf6e3' })` normalization. Wrap each candidate in `try/catch`, call `warn`, and continue. Stop after three successful buffers.

- [ ] **Step 4: Run the focused test suite**

Run: `npm run test:social-cards`

Expected: PASS with source-order, layout, and thumbnail tests.

- [ ] **Step 5: Commit thumbnail preparation**

```bash
git add scripts/social-card-media.mjs scripts/mermaid-social-config.json tests/social-card-media.test.mjs tests/fixtures/social-card-source.png
git commit -m "Render social card visual thumbnails"
```

### Task 4: Compose the adaptive rail into generated social cards

**Files:**
- Modify: `scripts/generate-social-cards.mjs`
- Modify: `scripts/social-card-media.mjs`
- Modify: `tests/social-card-media.test.mjs`

**Interfaces:**
- Produces `composeCard({ title, description, date, visuals }) => Promise<Buffer>`.
- Consumes the buffers from `prepareVisuals` and uses `visualLayout(visuals.length)`.
- The existing MD5 filename and `static/social/` output contract remain unchanged.

- [ ] **Step 1: Add composition tests**

Add a test that composes a card from three solid-color fixture buffers and asserts the final PNG dimensions and frame pixels:

```js
import { composeCard } from '../scripts/social-card-media.mjs';

test('composeCard produces a 1200 by 630 PNG with visual rail', async () => {
  const visual = await sharp({ create: { width: 226, height: 127, channels: 4, background: '#268bd2' } }).png().toBuffer();
  const card = await composeCard({ title: 'Visual card', description: 'Description', date: '2026-07-17T00:00:00+07:00', visuals: [visual, visual, visual] });
  assert.deepEqual(await sharp(card).metadata().then(({ width, height, format }) => ({ width, height, format })), { width: 1200, height: 630, format: 'png' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:social-cards`

Expected: FAIL because `composeCard` is not exported.

- [ ] **Step 3: Implement the compositing contract**

Build the text and border overlay as the existing Resvg SVG, with these changes:

- Frame x=72, y=164, width=1056, height=350, `stroke-width=4`.
- For zero visuals, title and description use the whole frame width.
- For one to three visuals, title and description use x=108 through x=810.
- Do not draw a section label or a separate horizontal divider above the frame.

Compose with Sharp in this order. Keep the current `cardSvg` function in the generator, change it to accept `hasVisualRail`, and render it into `textAndFramePng` before the Sharp composite:

```js
const textAndFramePng = new Resvg(cardSvg(card, { hasVisualRail: visuals.length > 0 }), {
  font: { fontFiles, loadSystemFonts: false },
}).render().asPng();
const base = sharp({ create: { width: 1200, height: 630, channels: 4, background: '#fdf6e3' } });
const rail = visualLayout(visuals.length).slots.map((slot, index) => ({
  input: await sharp(visuals[index]).extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#93a1a1' }).rotate(slot.rotation, { background: { r: 253, g: 246, b: 227, alpha: 0 } }).png().toBuffer(),
  left: slot.x,
  top: slot.y,
}));
return base.composite([...rail, { input: textAndFramePng, left: 0, top: 0 }]).png().toBuffer();
```

Update `generate-social-cards.mjs` to read each Markdown body, call `extractVisualSources`, call `prepareVisuals` using `static/` and a generated ignored work directory, then call `composeCard` before writing the existing MD5 filename. Pages without a source file and non-regular pages pass `visuals: []`.

- [ ] **Step 4: Run card generation and inspect representative outputs**

Run:

```bash
npm run test:social-cards
npm run generate:social-cards
file static/social/*.png | sed -n '1,3p'
```

Expected: all tests pass, generation completes, and outputs report `PNG image data, 1200 x 630`.

- [ ] **Step 5: Commit the adaptive rail**

```bash
git add scripts/generate-social-cards.mjs scripts/social-card-media.mjs tests/social-card-media.test.mjs
git commit -m "Add visual rails to social cards"
```

### Task 5: Verify Hugo output, fallback behavior, and production deploy

**Files:**
- Modify: `AGENTS.md`
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes the final generated PNG files and existing `layouts/partials/social-meta.html` metadata contract.
- Produces documented authoring behavior and verified public preview URLs.

- [ ] **Step 1: Document the visual selection rules**

Update `AGENTS.md` and `CONTEXT.md` to state that generated public-post cards select up to three local images or Mermaid diagrams in body order, use the adaptive 3/2/1 ratios, and fall back to full-width text.

- [ ] **Step 2: Run the complete production build**

Run: `npm run build`

Expected: Hugo completes successfully after social-card generation, and `public/posts/hermes-agent-setup/index.html` still contains its absolute `og:image` and `twitter:card` metadata.

- [ ] **Step 3: Check the zero-visual fallback**

Run:

```bash
node --input-type=module - <<'NODE'
import { composeCard } from './scripts/social-card-media.mjs';
import sharp from 'sharp';
const png = await composeCard({ title: 'Text only', description: 'No eligible visuals.', date: '2026-07-17T00:00:00+07:00', visuals: [] });
const { width, height } = await sharp(png).metadata();
if (width !== 1200 || height !== 630) process.exit(1);
NODE
```

Expected: exit status 0, proving that zero eligible visuals produces a complete text-only card.

- [ ] **Step 4: Deploy and verify a live image**

After committing and pushing the approved implementation, run:

```bash
vercel ls
vercel inspect <new-production-deployment-url>
curl -fsSI https://blog.abhipraya.dev/social/<known-card-hash>.png
```

Expected: deployment status is Ready and the live card responds with `content-type: image/png`.

- [ ] **Step 5: Commit documentation**

```bash
git add AGENTS.md CONTEXT.md
git commit -m "Document social card visual rails"
```
