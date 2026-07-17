import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const outputDir = join(root, 'static', 'social');
const siteDescription = 'Thoughts on software, systems, and stuff';
const width = 1200;
const height = 630;

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

function titleLayout(title) {
  for (let fontSize = 70; fontSize >= 36; fontSize -= 2) {
    const maxChars = Math.floor(1056 / (fontSize * 0.54));
    const lines = wrap(title, maxChars, 3);
    if (lines.length <= 2 && lines.join(' ').length === title.trim().replace(/\s+/g, ' ').length) {
      return { fontSize, lineHeight: Math.round(fontSize * 1.15), lines };
    }
  }
  return { fontSize: 36, lineHeight: 42, lines: wrap(title, 54, 2) };
}

function textLines(lines, x, baseline, lineHeight, attributes = '') {
  return lines.map((line, index) => `<text x="${x}" y="${baseline + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`).join('\n');
}

function cardSvg({ label, title, description }) {
  const titleBlock = titleLayout(title);
  const descriptionLines = wrap(description, 69, 3);
  const titleBaseline = 310;
  const titleBottom = titleBaseline + (titleBlock.lines.length - 1) * titleBlock.lineHeight;
  const descriptionBaseline = Math.max(438, titleBottom + 68);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#fdf6e3"/>
  <rect x="72" y="62" width="260" height="54" rx="0" fill="#586e75"/>
  <text x="91" y="99" fill="#fdf6e3" font-family="Arial, sans-serif" font-size="33" font-weight="700">~/abhipraya</text>
  <rect x="72" y="157" width="1056" height="3" fill="#268bd2"/>
  <text x="72" y="228" fill="#268bd2" font-family="Arial, sans-serif" font-size="23" font-weight="700" letter-spacing="2">${escapeXml(label)}</text>
  ${textLines(titleBlock.lines, 72, titleBaseline, titleBlock.lineHeight, `fill="#586e75" font-family="Arial, sans-serif" font-size="${titleBlock.fontSize}" font-weight="700"`)}
  ${textLines(descriptionLines, 72, descriptionBaseline, 30, 'fill="#657b83" font-family="Arial, sans-serif" font-size="24"')}
  <rect x="72" y="550" width="1056" height="1" fill="#93a1a1"/>
  <text x="72" y="587" fill="#657b83" font-family="Arial, sans-serif" font-size="21">blog.abhipraya.dev</text>
</svg>`;
}

function sourceLabel(record) {
  if (record.path === 'content/about.md') return 'ABOUT';
  if (record.path.endsWith('/_index.md')) return record.title === 'PPL' ? 'PPL' : 'SECTION';
  return record.section === 'ppl' ? 'PPL' : 'POSTS';
}

function fallbackDescription(record) {
  if (record.path === 'content/about.md') return 'About me';
  if (record.permalink === 'https://blog.abhipraya.dev/ppl/') return 'Course blogs and working notes.';
  if (record.path.endsWith('/_index.md')) return `Browse ${record.title}.`;
  return siteDescription;
}

const hugo = spawnSync('hugo', ['list', 'all'], { cwd: root, encoding: 'utf8' });
if (hugo.status !== 0) {
  process.stderr.write(hugo.stderr);
  process.exit(hugo.status ?? 1);
}

const records = hugo.stdout.trim().split('\n').slice(1).map((line) => {
  const [path, slug, title, date, expiryDate, publishDate, draft, permalink, kind, section] = parseCsvLine(line);
  return { path, slug, title, permalink, kind, section };
}).filter((record) => record.section !== 'private');

const cards = [
  { path: '/', label: 'HOME', title: 'Daffa Abhipraya', description: siteDescription },
  { path: '/tags/', label: 'TAGS', title: 'Tags', description: 'Posts organized by topic.' },
  ...records.map((record) => ({
    path: new URL(record.permalink).pathname,
    label: sourceLabel(record),
    title: record.title,
    description: descriptionFromSource(record.path) || fallbackDescription(record),
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
  cards.push({ path: `/tags/${slug}/`, label: 'TAG', title: `#${tag}`, description: `Posts tagged ${tag}.` });
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const card of cards) {
  const svg = cardSvg(card);
  const png = new Resvg(svg, {
    font: { loadSystemFonts: true },
  }).render().asPng();
  await writeFile(join(outputDir, `${cardId(card.path)}.png`), png);
}

console.log(`Generated ${cards.length} social preview cards.`);
