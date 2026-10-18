import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMermaidBlocks, pinnedMermaidVersion } from '../scripts/check-mermaid.mjs';

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
