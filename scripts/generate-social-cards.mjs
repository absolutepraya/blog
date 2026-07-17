import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { composeCard, extractVisualSources, prepareVisuals } from './social-card-media.mjs';

const root = process.cwd();
const outputDir = join(root, 'static', 'social');
const siteDescription = 'Thoughts on software, systems, and stuff';
const width = 1200;
const height = 630;
const fontFiles = [
  join(root, 'static/fonts/ubuntu-400.ttf'),
  join(root, 'static/fonts/ubuntu-700.ttf'),
  join(root, 'static/fonts/ubuntu-mono-400.ttf'),
  join(root, 'static/fonts/ubuntu-mono-700.ttf'),
];

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function cardId(path) {
  return createHash('md5').update(path).digest('hex');
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char]);
}

function descriptionFromSource(path) {
  if (!path) return '';
  try {
    const source = readFileSync(join(root, path), 'utf8');
    const match = source.match(/^(?:description|summary)\s*[:=]\s*["']?(.+?)["']?\s*$/m);
    return match ? match[1].replace(/["']$/, '').trim() : '';
  } catch {
    return '';
  }
}

function wrap(text, maxChars, maxLines) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function titleLayout(title, maxWidth) {
  for (let fontSize = 70; fontSize >= 28; fontSize -= 2) {
    const maxChars = Math.floor(maxWidth / (fontSize * 0.54));
    const lines = wrap(title, maxChars, 3);
    if (lines.length <= 2 && lines.join(' ').length === title.trim().replace(/\s+/g, ' ').length) {
      return { fontSize, lineHeight: Math.round(fontSize * 1.15), lines };
    }
  }
  const fontSize = 28;
  const maxChars = Math.floor(maxWidth / (fontSize * 0.54));
  return { fontSize, lineHeight: Math.round(fontSize * 1.15), lines: wrap(title, maxChars, 2) };
}

function textLines(lines, x, baseline, lineHeight, attributes = '') {
  return lines.map((line, index) => `<text x="${x}" y="${baseline + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`).join('\n');
}

function formatDate(value) {
  if (!value || value.startsWith('0001-01-01')) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value)).toUpperCase();
}

function cardSvg({ title, description, date, hasVisualRail }) {
  const textWidth = hasVisualRail ? 690 : 984;
  const titleBlock = titleLayout(title, textWidth);
  const descriptionLines = wrap(description, Math.floor(textWidth / 12.5), 3);
  const titleBaseline = 246;
  const titleBottom = titleBaseline + (titleBlock.lines.length - 1) * titleBlock.lineHeight;
  const descriptionBaseline = Math.max(384, titleBottom + 52);
  const dateText = formatDate(date);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="72" y="72" width="270" height="56" fill="#586e75"/>
  <text x="80" y="117" fill="#fdf6e3" font-family="Ubuntu" font-size="40" font-weight="700" letter-spacing="2">~/abhipraya</text>
  ${dateText ? `<text x="1128" y="112" text-anchor="end" fill="#586e75" font-family="Ubuntu Mono" font-size="24">${dateText}</text>` : ''}
  <rect x="72" y="164" width="1056" height="350" fill="none" stroke="#93a1a1" stroke-width="4"/>
  ${textLines(titleBlock.lines, 108, titleBaseline, titleBlock.lineHeight, `fill="#586e75" font-family="Ubuntu" font-size="${titleBlock.fontSize}" font-weight="700"`)}
  ${textLines(descriptionLines, 108, descriptionBaseline, 30, 'fill="#657b83" font-family="Ubuntu" font-size="24"')}
  <text x="72" y="555" fill="#657b83" font-family="Ubuntu Mono" font-size="21">blog.abhipraya.dev</text>
</svg>`;
}

function fallbackDescription(record) {
  if (record.path === 'content/about.md') return 'About me';
  if (record.permalink === 'https://blog.abhipraya.dev/ppl/') return 'Course blogs and working notes.';
  if (record.path.endsWith('/_index.md')) return `Browse ${record.title}.`;
  return siteDescription;
}

function sourceFromPath(path) {
  if (!path) return '';
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return '';
  }
}

const hugo = spawnSync('hugo', ['list', 'all'], { cwd: root, encoding: 'utf8' });
if (hugo.status !== 0) {
  process.stderr.write(hugo.stderr);
  process.exit(hugo.status ?? 1);
}

const records = hugo.stdout.trim().split('\n').slice(1).map((line) => {
  const [path, slug, title, date, expiryDate, publishDate, draft, permalink, kind, section] = parseCsvLine(line);
  return { path, slug, title, date, permalink, kind, section };
}).filter((record) => record.section !== 'private');

const cards = [
  { path: '/', title: 'Daffa Abhipraya', description: siteDescription },
  { path: '/tags/', title: 'Tags', description: 'Posts organized by topic.' },
  ...records.map((record) => ({
    path: new URL(record.permalink).pathname,
    title: record.title,
    description: descriptionFromSource(record.path) || fallbackDescription(record),
    date: record.date,
    body: record.kind === 'page' ? sourceFromPath(record.path) : '',
  })),
];

const tags = new Set();
for (const record of records) {
  if (!record.path.endsWith('.md')) continue;
  const source = readFileSync(join(root, record.path), 'utf8');
  const tagBlock = source.match(/^tags:\s*\[([^\]]+)\]/m);
  if (!tagBlock) continue;
  for (const tag of tagBlock[1].split(',')) {
    const value = tag.trim().replace(/^['"]|['"]$/g, '');
    if (value) tags.add(value);
  }
}
for (const tag of tags) {
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  cards.push({ path: `/tags/${slug}/`, title: `#${tag}`, description: `Posts tagged ${tag}.` });
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const workDir = await mkdtemp(join(tmpdir(), 'blog-social-card-'));
try {
  for (const card of cards) {
    const visuals = card.body ? await prepareVisuals({
      sources: extractVisualSources(card.body),
      staticDir: join(root, 'static'),
      workDir,
      warn: (message) => process.stderr.write(`${message}\n`),
    }) : [];
    const svg = cardSvg({ ...card, hasVisualRail: visuals.length > 0 });
    const overlay = new Resvg(svg, {
      font: { fontFiles, loadSystemFonts: false },
    }).render().asPng();
    const png = await composeCard({ visuals, overlay, width, height });
    await writeFile(join(outputDir, `${cardId(card.path)}.png`), png);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}

console.log(`Generated ${cards.length} social preview cards.`);
