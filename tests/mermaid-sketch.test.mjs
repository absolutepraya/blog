import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_FAMILY,
  KEPT_CLASSES,
  ROLE_VARS,
  colorMix,
  contrastRatio,
  hexToRgb,
  rgbToHex,
  roundedRectPath,
  sketchClassName,
  sketchTheme,
} from '../assets/js/mermaid-sketch.js';

// Light Solarized values, so the theme can be built without a browser.
const light = {
  '--mermaid-bg': '#fdf6e3',
  '--mermaid-fg': '#657b83',
  '--mermaid-accent': '#268bd2',
  '--mermaid-pie1': '#268bd2',
  '--mermaid-pie2': '#2aa198',
  '--mermaid-pie3': '#859900',
  '--mermaid-pie4': '#b58900',
  '--mermaid-pie5': '#cb4b16',
  '--mermaid-pie6': '#6c71c4',
  '--mermaid-pie7': '#d33682',
  '--mermaid-pie8': '#dc322f',
};
const read = (name, fallback) => light[name] ?? fallback;

test('hex and rgb conversions round-trip', () => {
  assert.deepEqual(hexToRgb('#268bd2'), [38, 139, 210]);
  assert.equal(rgbToHex([38, 139, 210]), '#268bd2');
  assert.equal(rgbToHex([300, -5, 0]), '#ff0000');
});

test('colorMix blends the first color over the second by percentage', () => {
  assert.equal(colorMix('#000000', '#ffffff', 50), '#808080');
  assert.equal(colorMix('#268bd2', '#fdf6e3', 100), '#268bd2');
  assert.equal(colorMix('#268bd2', '#fdf6e3', 0), '#fdf6e3');
});

test('contrastRatio matches the WCAG extremes', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(contrastRatio([10, 20, 30], [10, 20, 30]), 1);
});

test('sketchTheme tints every role and keeps the rules off the rough.js paths', () => {
  const { themeCSS, themeVariables, elk } = sketchTheme(false, read);
  for (const role of Object.keys(ROLE_VARS)) {
    assert.ok(themeCSS.includes(`.node.${role} rect`), `missing tint rule for ${role}`);
    assert.ok(themeCSS.includes(`.node.${role} path:not(.sk)`), `${role} rule must skip sketch paths`);
  }
  assert.ok(themeCSS.includes(colorMix('#268bd2', '#fdf6e3', 16)), 'svc fill is a 16 percent tint of its hue');
  assert.equal(themeVariables.fontFamily, FONT_FAMILY);
  assert.equal(themeVariables.cScale0, '#268bd2');
  assert.equal(themeVariables.xyChart.backgroundColor, '#fdf6e3');
  assert.equal(themeVariables.xyChart.plotColorPalette.split(',').length, 8);
  assert.deepEqual(elk, { cycleBreakingStrategy: 'DEPTH_FIRST' });
});

test('roundedRectPath traces four arcs and clamps the radius to the box', () => {
  const path = roundedRectPath(10, 20, 100, 40, 5, 5);
  assert.ok(path.startsWith('M15,20'), 'starts after the top-left corner');
  assert.equal((path.match(/A/g) || []).length, 4);
  assert.ok(path.endsWith('Z'));
  // A radius larger than half the box collapses to a stadium instead of overshooting.
  assert.ok(roundedRectPath(0, 0, 100, 20, 50, 50).includes('A50,10'));
  // A lone rx or ry applies to both axes, as in SVG.
  assert.ok(roundedRectPath(0, 0, 100, 40, 6, 0).includes('A6,6'));
});

test('sketchClassName keeps the classes that drive pie highlighting and drops the rest', () => {
  assert.deepEqual(KEPT_CLASSES, ['pieCircle', 'highlighted', 'highlightedOnHover']);
  assert.equal(sketchClassName('pieCircle highlighted'), 'sketch pieCircle highlighted');
  assert.equal(sketchClassName('pieCircle highlightedOnHover'), 'sketch pieCircle highlightedOnHover');
  assert.equal(sketchClassName('basic label-container'), 'sketch');
  assert.equal(sketchClassName(null), 'sketch');
});
