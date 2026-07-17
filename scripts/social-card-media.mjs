import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rail = { x: 846, y: 184, width: 246, height: 310 };
const scriptDir = dirname(fileURLToPath(import.meta.url));

function cropSize(ratio) {
  if (ratio === '16:9') return [226, 127];
  if (ratio === '4:3') return [226, 170];
  return [220, 220];
}

async function renderMermaid(source, workDir, index) {
  const inputPath = join(workDir, `diagram-${index}.mmd`);
  const outputPath = join(workDir, `diagram-${index}.svg`);
  const configPath = join(scriptDir, 'mermaid-social-config.json');

  await writeFile(inputPath, source);
  execFileSync('npx', [
    'mmdc',
    '-i', inputPath,
    '-o', outputPath,
    '-c', configPath,
    '-b', 'transparent',
  ], { stdio: 'pipe' });
  return outputPath;
}

export function extractVisualSources(body) {
  const pattern = /!\[[^\]]*\]\((\/images\/[^)\s]+)[^)]*\)|{{<\s*figure\s+[^>]*src=["'](\/images\/[^"']+)["'][^>]*>}}|```mermaid\s*\n([\s\S]*?)```/g;
  const sources = [];

  for (const match of body.matchAll(pattern)) {
    if (match[1] || match[2]) {
      sources.push({ kind: 'image', value: match[1] || match[2] });
    }
    if (match[3]) {
      sources.push({ kind: 'mermaid', value: match[3].trim() });
    }
  }

  return sources;
}

export function visualLayout(count) {
  if (count >= 3) {
    return {
      ratio: '16:9',
      slots: [
        { x: rail.x + 2, y: rail.y + 4, width: 226, height: 127, rotation: -4 },
        { x: rail.x + 16, y: rail.y + 92, width: 226, height: 127, rotation: 3 },
        { x: rail.x + 2, y: rail.y + 180, width: 226, height: 127, rotation: -2 },
      ],
    };
  }

  if (count === 2) {
    return {
      ratio: '4:3',
      slots: [
        { x: rail.x + 2, y: rail.y + 8, width: 226, height: 170, rotation: -4 },
        { x: rail.x + 16, y: rail.y + 132, width: 226, height: 170, rotation: 3 },
      ],
    };
  }

  if (count === 1) {
    return {
      ratio: '1:1',
      slots: [
        { x: rail.x + 8, y: rail.y + 40, width: 220, height: 220, rotation: -2 },
      ],
    };
  }

  return { ratio: null, slots: [] };
}

export async function prepareVisuals({ sources, staticDir, workDir, ratio, warn }) {
  const prepared = [];

  for (const [index, source] of sources.entries()) {
    if (prepared.length === 3) break;

    try {
      const inputPath = source.kind === 'image'
        ? join(staticDir, source.value.replace(/^\/images\//, 'images/'))
        : await renderMermaid(source.value, workDir, index);
      const metadata = await sharp(inputPath).metadata();
      const position = metadata.height > metadata.width
        ? 'top'
        : metadata.width > metadata.height
          ? 'left'
          : 'centre';
      const resize = source.kind === 'image'
        ? { fit: 'cover', position }
        : { fit: 'contain', background: '#fdf6e3' };
      prepared.push({ input: await sharp(inputPath).png().toBuffer(), resize });
    } catch (error) {
      warn(`Skipped social-card ${source.kind} visual: ${error.message}`);
    }
  }

  const selectedRatio = ratio || visualLayout(prepared.length).ratio;
  if (!selectedRatio) return [];

  const [width, height] = cropSize(selectedRatio);
  return Promise.all(prepared.map(({ input, resize }) => sharp(input)
    .resize(width, height, resize)
    .png()
    .toBuffer()));
}

async function framedVisual(buffer, rotation) {
  const bordered = await sharp(buffer)
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#93a1a1' })
    .png()
    .toBuffer();
  return sharp(bordered)
    .rotate(rotation, { background: { r: 253, g: 246, b: 227, alpha: 0 } })
    .png()
    .toBuffer();
}

export async function composeCard({ visuals, overlay, width = 1200, height = 630 }) {
  const layout = visualLayout(visuals.length);
  const visualLayers = await Promise.all(visuals.map((visual, index) => framedVisual(visual, layout.slots[index].rotation)));
  return sharp({
    create: { width, height, channels: 4, background: '#fdf6e3' },
  }).composite([
    ...visualLayers.map((input, index) => ({
      input,
      left: layout.slots[index].x,
      top: layout.slots[index].y,
    })),
    ...(overlay ? [{ input: overlay, left: 0, top: 0 }] : []),
  ]).png().toBuffer();
}
