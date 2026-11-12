import test from 'node:test';
import assert from 'node:assert/strict';
import { CDN_PACKAGES, extractMermaidBlocks, pinnedMermaidVersion, pinnedVersion } from '../scripts/check-mermaid.mjs';

test('extractMermaidBlocks returns each block with its starting line', () => {
  const markdown = [
    '# Title',
    '',
    '```mermaid',
    'graph TD',
    '    A --> B',
    '```',
    '',
    '```js',
    'console.log(1)',
    '```',
    '',
    '```mermaid',
    'pie',
    '    "a" : 1',
    '```',
  ].join('\n');

  assert.deepEqual(extractMermaidBlocks(markdown), [
    { line: 3, source: 'graph TD\n    A --> B\n' },
    { line: 12, source: 'pie\n    "a" : 1\n' },
  ]);
});

test('extractMermaidBlocks ignores indented examples inside other fences', () => {
  const markdown = '````markdown\n  ```mermaid\n  graph TD\n  ```\n````\n';
  assert.deepEqual(extractMermaidBlocks(markdown), []);
});

test('pinnedMermaidVersion reads the CDN pin and reports a missing one', () => {
  assert.equal(
    pinnedMermaidVersion("import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs';"),
    '11.16.0',
  );
  assert.equal(
    pinnedMermaidVersion("import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.esm.min.mjs';"),
    null,
  );
});

test('pinnedVersion reads each CDN pin, including scoped packages', () => {
  const template = [
    "import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs';",
    "import elk from 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.2.2/dist/mermaid-layout-elk.esm.min.mjs';",
    "import rough from 'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js';",
  ].join('\n');

  assert.deepEqual(CDN_PACKAGES, ['mermaid', '@mermaid-js/layout-elk', 'roughjs']);
  assert.equal(pinnedVersion(template, 'mermaid'), '11.16.0');
  assert.equal(pinnedVersion(template, '@mermaid-js/layout-elk'), '0.2.2');
  assert.equal(pinnedVersion(template, 'roughjs'), '4.6.6');
  assert.equal(pinnedVersion(template, 'missing-package'), null);
});
