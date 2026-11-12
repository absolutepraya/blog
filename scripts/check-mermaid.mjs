// Render every Mermaid block under content/ and fail when any diagram does not render.
// The site loads Mermaid, its ELK layout and rough.js from pinned CDN URLs in baseof.html, so this
// also fails when a pin drifts from the version installed here (mermaid-cli renders with Mermaid).
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { renderMermaid } from '@mermaid-js/mermaid-cli';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// CDN-loaded packages whose pin in baseof.html must match the installed version.
export const CDN_PACKAGES = ['mermaid', '@mermaid-js/layout-elk', 'roughjs'];

export function extractMermaidBlocks(markdown) {
  const blocks = [];
  const pattern = /^```mermaid[^\n]*\n([\s\S]*?)^```/gm;
  for (const match of markdown.matchAll(pattern)) {
    const line = markdown.slice(0, match.index).split('\n').length;
    blocks.push({ line, source: match[1] });
  }
  return blocks;
}

export function pinnedVersion(template, pkg) {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return template.match(new RegExp(`cdn\\.jsdelivr\\.net/npm/${escaped}@([^/]+)/`))?.[1] ?? null;
}

export function pinnedMermaidVersion(template) {
  return pinnedVersion(template, 'mermaid');
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

  const template = await readFile(join(root, 'layouts/_default/baseof.html'), 'utf8');
  const installedVersions = {};
  for (const pkg of CDN_PACKAGES) {
    installedVersions[pkg] = JSON.parse(await readFile(require.resolve(`${pkg}/package.json`), 'utf8')).version;
    const pinned = pinnedVersion(template, pkg);
    if (pinned !== installedVersions[pkg]) {
      failures.push(`layouts/_default/baseof.html: ${pkg} CDN pin is ${pinned ?? 'missing'}, but ${installedVersions[pkg]} is installed. Pin ${pkg}@${installedVersions[pkg]}.`);
    }
  }
  const installed = installedVersions.mermaid;

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
