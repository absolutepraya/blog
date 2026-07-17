const rail = { x: 846, y: 184, width: 246, height: 310 };

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
