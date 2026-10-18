// Render every Mermaid block under content/ and fail when any diagram does not render.
// The site loads Mermaid from a pinned CDN URL in baseof.html, so this also fails when
// that pin drifts from the Mermaid version mermaid-cli renders with here.
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { renderMermaid } from '@mermaid-js/mermaid-cli';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pinPattern = /cdn\.jsdelivr\.net\/npm\/mermaid@([^/]+)\//;

export function extractMermaidBlocks(markdown) {
  const blocks = [];
  const pattern = /^```mermaid[^\n]*\n([\s\S]*?)^```/gm;
  for (const match of markdown.matchAll(pattern)) {
    const line = markdown.slice(0, match.index).split('\n').length;
    blocks.push({ line, source: match[1] });
  }
  return blocks;
}

export function pinnedMermaidVersion(template) {
  return template.match(pinPattern)?.[1] ?? null;
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  }));
  return files.flat();
}

async function main() {
  const failures = [];

  const installed = require('mermaid/package.json').version;
  const template = await readFile(join(root, 'layouts/_default/baseof.html'), 'utf8');
  const pinned = pinnedMermaidVersion(template);
  if (pinned !== installed) {
    failures.push(`layouts/_default/baseof.html: Mermaid CDN pin is ${pinned ?? 'missing'}, but the checker renders with ${installed}. Pin mermaid@${installed}.`);
  }

  const files = await markdownFiles(join(root, 'content'));
  const blocks = [];
  for (const file of files) {
    for (const block of extractMermaidBlocks(await readFile(file, 'utf8'))) {
      blocks.push({ file: relative(root, file), ...block });
    }
  }

  // CI runners on Ubuntu 23.10+ block Chromium's sandbox, so share the social-card launch config.
  const launchConfig = JSON.parse(await readFile(join(root, 'scripts/puppeteer-config.json'), 'utf8'));
  const browser = await puppeteer.launch({ headless: true, ...launchConfig });
  try {
    for (const block of blocks) {
      try {
        await renderMermaid(browser, block.source, 'svg', {
          mermaidConfig: { theme: 'base', htmlLabels: true },
        });
      } catch (error) {
        const reason = String(error?.message ?? error).split('\n').slice(0, 3).join(' ');
        failures.push(`${block.file}:${block.line}: ${reason}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(`Mermaid check failed (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log(`Mermaid check passed: ${blocks.length} diagrams in ${files.length} files, CDN pinned to ${installed}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
